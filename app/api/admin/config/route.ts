/**
 * app/api/admin/config/route.ts
 * GET  — legge config prodotto (NON restituisce le key cifrate)
 * POST — salva config, cifra le API key prima di persistere
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { encrypt, decryptSafe } from '@/lib/crypto';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

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

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = req.nextUrl.searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const { data, error } = await supabase
    .from('products')
    .select(`
      id, name, short_name, persona, domain, guardrails, language,
      retriever_provider, retriever_model, retriever_api_key_enc,
      orchestrator_provider, orchestrator_model, orchestrator_api_key_enc,
      suggested_questions
    `)
    .eq('id', productId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Indica se la key è già salvata senza esporre il valore
  const retriever_key_saved    = !!data.retriever_api_key_enc;
  const orchestrator_key_saved = !!data.orchestrator_api_key_enc;

  // Rimuovi i campi cifrati dalla risposta
  const { retriever_api_key_enc, orchestrator_api_key_enc, ...safe } = data;

  return NextResponse.json({
    ...safe,
    retriever_key_saved,
    orchestrator_key_saved,
    suggested_questions: data.suggested_questions ?? [],
  });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    productId,
    // Existing config fields
    persona, domain, guardrails, language,
    // LLM config
    retriever_provider, retriever_model, retriever_api_key,
    orchestrator_provider, orchestrator_model, orchestrator_api_key,
    // Domande suggerite
    suggested_questions,
  } = body;

  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  // Leggi la config attuale per confrontare i provider
  const { data: current } = await supabase
    .from('products')
    .select('retriever_provider, orchestrator_provider, retriever_api_key_enc, orchestrator_api_key_enc')
    .eq('id', productId)
    .single();

  // Build update payload
  const update: Record<string, unknown> = {
    persona, domain, guardrails, language,
    retriever_provider,   retriever_model,
    orchestrator_provider, orchestrator_model,
    suggested_questions: Array.isArray(suggested_questions) ? suggested_questions : [],
  };

  // Gestione key retriever
  if (retriever_api_key && retriever_api_key.trim() !== '') {
    // Nuova key fornita → cifra e salva
    update.retriever_api_key_enc = encrypt(retriever_api_key.trim());
  } else if (current && current.retriever_provider !== retriever_provider) {
    // Provider cambiato senza nuova key → cancella la vecchia key (era per il provider precedente)
    update.retriever_api_key_enc = null;
  }

  // Gestione key orchestrator
  if (orchestrator_api_key && orchestrator_api_key.trim() !== '') {
    // Nuova key fornita → cifra e salva
    update.orchestrator_api_key_enc = encrypt(orchestrator_api_key.trim());
  } else if (current && current.orchestrator_provider !== orchestrator_provider) {
    // Provider cambiato senza nuova key → cancella la vecchia key
    update.orchestrator_api_key_enc = null;
  }

  const { error } = await supabase
    .from('products')
    .update(update)
    .eq('id', productId);

  if (error) {
    console.error('Config update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
