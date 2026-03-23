/**
 * app/api/chat/route.ts
 * POST /api/chat
 * Esegue Retriever → Orchestratore e salva i messaggi su Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import Anthropic from "@anthropic-ai/sdk";
import { RETRIEVER_SYSTEM_PROMPT, buildOrchestratorPrompt } from "@/lib/prompts";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  question: string;
  productId: string;
  history: Message[];
  conversationId?: string; // ✅ NUOVO: se presente salva i messaggi su DB
}

interface ChunkRow {
  chunk_id: string;
  heading: string;
  text: string;
  note: string | null;
}

function makeSupabaseClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

function buildChunksXml(chunks: ChunkRow[]): string {
  return chunks.map((c, i) => {
    const noteAttr = c.note ? ` note="${escAttr(c.note)}"` : "";
    return `<chunk index="${i}" id="${escAttr(c.chunk_id)}"${noteAttr}>${escText(c.text)}</chunk>`;
  }).join("\n");
}

function buildSourcesXml(chunks: ChunkRow[]): string {
  return chunks.map(c =>
    `<source id="${escAttr(c.chunk_id)}" heading="${escAttr(c.heading)}">\n${escText(c.text)}\n</source>`
  ).join("\n");
}

function escAttr(s: string) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
function escText(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function parseRetrieverResponse(raw: string): number[] {
  const match = raw.match(/\[[\d,\s]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0);
  } catch { return []; }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: ChatRequest;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body non valido" }, { status: 400 }); }

  const { question, productId, history, conversationId } = body;
  if (!question?.trim() || !productId?.trim()) {
    return NextResponse.json({ error: "question e productId obbligatori" }, { status: 400 });
  }

  const supabase = makeSupabaseClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // Carica tutti i chunk del prodotto
  const { data: chunks, error: dbError } = await supabase
    .from("chunks")
    .select("chunk_id, heading, text, note")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (dbError) return NextResponse.json({ error: "Errore database" }, { status: 500 });
  if (!chunks || chunks.length === 0)
    return NextResponse.json({ error: "Nessun chunk trovato per questo prodotto" }, { status: 404 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // ── AGENTE 1: RETRIEVER ──────────────────────────────────────────────────
  // Sonnet 4.5 per ragionamento semantico più robusto (sinonimi, multi-intent)
  const chunksXml = buildChunksXml(chunks as ChunkRow[]);
  let rawRetrieverResponse: string;
  try {
    const retrieverMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: RETRIEVER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${chunksXml}\n\nDomanda: ${question}` }],
    });
    rawRetrieverResponse = retrieverMsg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("") ?? "[]";
  } catch (err) {
    console.error("[chat] Retriever error:", err);
    return NextResponse.json({ error: "Errore Retriever" }, { status: 502 });
  }

  const selectedIndices = parseRetrieverResponse(rawRetrieverResponse);
  const allChunks = chunks as ChunkRow[];
  const selectedChunks: ChunkRow[] = selectedIndices.length > 0
    ? selectedIndices.filter(i => i < allChunks.length).slice(0, 5).map(i => allChunks[i])
    : [];
  const selectedChunkIds = selectedChunks.map(c => c.chunk_id);

  // ── AGENTE 2: ORCHESTRATORE ──────────────────────────────────────────────
  const { data: productRow } = await supabase
    .from("products")
    .select("persona, domain, guardrails, language")
    .eq("id", productId)
    .single();

  const orchestratorSystem = buildOrchestratorPrompt(productRow ?? {});
  const sourcesXml = selectedChunks.length > 0
    ? buildSourcesXml(selectedChunks)
    : "<source>Nessun chunk rilevante trovato.</source>";

  const orchestratorMessages: Message[] = [
    ...(history ?? []),
    { role: "user", content: `${sourcesXml}\n\n${question}` },
  ];

  let answer: string;
  try {
    const orchestratorMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: orchestratorSystem,
      messages: orchestratorMessages,
    });
    answer = orchestratorMsg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("") ?? "";
  } catch (err) {
    console.error("[chat] Orchestrator error:", err);
    return NextResponse.json({ error: "Errore Orchestrator" }, { status: 502 });
  }

  // ── SALVA MESSAGGI SU DB (se conversationId presente) ────────────────────
  if (conversationId) {
    try {
      // Salva messaggio utente
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: question,
        source_ids: [],
      });
      // Salva risposta assistente
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: answer,
        source_ids: selectedChunkIds,
      });
      // Aggiorna updated_at conversazione
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (err) {
      console.warn("[chat] Salvataggio messaggi fallito:", err);
    }
  }

  // ── AUDIT LOG ────────────────────────────────────────────────────────────
  try {
    await supabase.from("audit_log").insert({
      user_id: user.id,
      product_id: productId,
      question,
      answer,
      chunks_used: selectedChunkIds,
    });
  } catch (err) {
    console.warn("[chat] Audit log insert failed:", err);
  }

  return NextResponse.json({ answer, sources: selectedChunkIds });
}
