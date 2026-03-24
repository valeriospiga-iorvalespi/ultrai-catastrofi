/**
 * app/api/chat/route.ts
 * Retriever + Orchestrator con provider/model dinamici per prodotto.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getRetrieverPrompt, getOrchestratorPrompt } from '@/lib/prompts';
import { callLLM, LLMProvider } from '@/lib/llm-adapter';
import { decryptSafe } from '@/lib/crypto';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    question,
    productId,
    conversationId,
    history = [],
  }: {
    question: string;
    productId: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  } = await req.json();

  if (!question || !productId) {
    return NextResponse.json({ error: 'Missing question or productId' }, { status: 400 });
  }

  // ── 1. Load product config (inclusi LLM fields) ───────────────────────────
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select(`
      id, name, persona, domain, guardrails, language,
      retriever_provider, retriever_model, retriever_api_key_enc,
      orchestrator_provider, orchestrator_model, orchestrator_api_key_enc
    `)
    .eq('id', productId)
    .single();

  if (prodError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // ── 2. Decrypt keys ────────────────────────────────────────────────────────
  const retrieverKey    = decryptSafe(product.retriever_api_key_enc);
  const orchestratorKey = decryptSafe(product.orchestrator_api_key_enc);

  const retrieverProvider    = (product.retriever_provider    ?? 'anthropic') as LLMProvider;
  const retrieverModel       = product.retriever_model        ?? 'claude-sonnet-4-5-20251022';
  const orchestratorProvider = (product.orchestrator_provider ?? 'anthropic') as LLMProvider;
  const orchestratorModel    = product.orchestrator_model     ?? 'claude-haiku-4-5-20251001';

  // ── 3. Load all chunks for this product ───────────────────────────────────
  const { data: chunks, error: chunkError } = await supabase
    .from('chunks')
    .select('id, chunk_id, section, article, heading, text, note')
    .eq('product_id', productId)
    .order('id');

  if (chunkError || !chunks?.length) {
    return NextResponse.json({ error: 'No chunks found for this product' }, { status: 404 });
  }

  // ── 4. RETRIEVER ─────────────────────────────────────────────────────────
  const retrieverSystemPrompt = getRetrieverPrompt(product);
  const chunkList = chunks
    .map((c, i) => `[${i}] chunk_id=${c.chunk_id} | ${c.heading ?? c.article ?? c.section ?? ''}\n${c.note ?? ''}\n${c.text.slice(0, 300)}`)
    .join('\n\n');

  const retrieverUserPrompt = `DOMANDA: ${question}\n\nCHUNK DISPONIBILI:\n${chunkList}`;

  let selectedIndices: number[] = [];
  try {
    const retrieverResponse = await callLLM({
      provider:     retrieverProvider,
      model:        retrieverModel,
      apiKey:       retrieverKey,
      systemPrompt: retrieverSystemPrompt,
      userPrompt:   retrieverUserPrompt,
      maxTokens:    300,
    });

    // Parse JSON array from retriever response
    const match = retrieverResponse.text.match(/\[[\d,\s]+\]/);
    if (match) {
      selectedIndices = JSON.parse(match[0]).filter(
        (i: number) => i >= 0 && i < chunks.length
      );
    }
  } catch (err) {
    console.error('Retriever error:', err);
  }

  // Fallback: first 5 chunks
  if (!selectedIndices.length) selectedIndices = [0, 1, 2, 3, 4].slice(0, chunks.length);

  const selectedChunks = selectedIndices.slice(0, 5).map((i) => chunks[i]);

  // ── 5. ORCHESTRATOR ───────────────────────────────────────────────────────
  const orchestratorSystemPrompt = getOrchestratorPrompt(product);
  const chunkContext = selectedChunks
    .map((c) => `{{${c.chunk_id}}}\n${c.text}`)
    .join('\n\n---\n\n');

  const orchestratorUserPrompt =
    `DOMANDA: ${question}\n\nFONTI SELEZIONATE:\n${chunkContext}`;

  let answer = '';
  try {
    const orchestratorResponse = await callLLM({
      provider:     orchestratorProvider,
      model:        orchestratorModel,
      apiKey:       orchestratorKey,
      systemPrompt: orchestratorSystemPrompt,
      userPrompt:   orchestratorUserPrompt,
      maxTokens:    1500,
      history,
    });
    answer = orchestratorResponse.text;
  } catch (err) {
    console.error('Orchestrator error:', err);
    return NextResponse.json({ error: 'Orchestrator failed' }, { status: 500 });
  }

  // ── 6. Extract cited chunk_ids ────────────────────────────────────────────
  const citedIds = [...answer.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
  const uniqueCitedIds = [...new Set(citedIds)];

  // ── 7. Persist to DB ──────────────────────────────────────────────────────
  if (conversationId) {
    try {
      await supabase.from('messages').insert([
        { conversation_id: conversationId, role: 'user',      content: question, source_ids: [] },
        { conversation_id: conversationId, role: 'assistant', content: answer,   source_ids: uniqueCitedIds },
      ]);
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (err) {
      console.error('Persist error:', err);
    }
  }

  // ── 8. Audit log ──────────────────────────────────────────────────────────
  try {
    await supabase.from('audit_log').insert({
      user_id:     user.id,
      product_id:  productId,
      question,
      answer,
      chunks_used: uniqueCitedIds,
    });
  } catch {
    // Non bloccante
  }

  return NextResponse.json({
    answer,
    chunks: selectedChunks.map((c) => ({
      id:       c.id,
      chunk_id: c.chunk_id,
      heading:  c.heading,
      section:  c.section,
      article:  c.article,
      text:     c.text,
    })),
    cited_ids: uniqueCitedIds,
    // Esponi provider+model usati (utile per debug/display)
    models: {
      retriever:    { provider: retrieverProvider,    model: retrieverModel },
      orchestrator: { provider: orchestratorProvider, model: orchestratorModel },
    },
  });
}
