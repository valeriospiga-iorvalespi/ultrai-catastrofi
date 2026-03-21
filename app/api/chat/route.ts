/**
 * app/api/chat/route.ts
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
}

interface ChunkRow {
  chunk_id: string;
  heading: string;
  text: string;
  note: string | null;
}

function makeSupabaseClient(request: NextRequest) {
  const response = NextResponse.next();
  return {
    supabase: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value; },
          set(name: string, value: string, options: Record<string, unknown>) { response.cookies.set({ name, value, ...options }); },
          remove(name: string, options: Record<string, unknown>) { response.cookies.set({ name, value: "", ...options }); },
        },
      }
    ),
    response,
  };
}

function buildChunksXml(chunks: ChunkRow[]): string {
  return chunks.map((c, i) => {
    const noteAttr = c.note ? ` note="${escapeAttr(c.note)}"` : "";
    return `<chunk index="${i}" id="${escapeAttr(c.chunk_id)}"${noteAttr}>${escapeText(c.text)}</chunk>`;
  }).join("\n");
}

function buildSourcesXml(chunks: ChunkRow[]): string {
  return chunks.map((c) =>
    `<source id="${escapeAttr(c.chunk_id)}" heading="${escapeAttr(c.heading)}">\n${escapeText(c.text)}\n</source>`
  ).join("\n");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  const { question, productId, history } = body;
  if (!question?.trim() || !productId?.trim()) {
    return NextResponse.json({ error: "question e productId sono obbligatori" }, { status: 400 });
  }

  const { supabase } = makeSupabaseClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: chunks, error: dbError } = await supabase
    .from("chunks")
    .select("chunk_id, heading, text, note")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (dbError) {
    console.error("[chat] DB error:", dbError);
    return NextResponse.json({ error: "Errore database" }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: "Nessun chunk trovato per questo prodotto" }, { status: 404 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const chunksXml = buildChunksXml(chunks as ChunkRow[]);
  const retrieverUserMessage = `${chunksXml}\n\nDomanda: ${question}`;

  let rawRetrieverResponse: string;
  try {
    const retrieverMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: RETRIEVER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: retrieverUserMessage }],
    });
    rawRetrieverResponse = retrieverMsg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") ?? "[]";
  } catch (err) {
    console.error("[chat] Retriever error:", err);
    return NextResponse.json({ error: "Errore Retriever" }, { status: 502 });
  }

  const selectedIndices = parseRetrieverResponse(rawRetrieverResponse);
  const allChunks = chunks as ChunkRow[];
  const selectedChunks: ChunkRow[] = selectedIndices.length > 0
    ? selectedIndices.filter((i) => i < allChunks.length).slice(0, 5).map((i) => allChunks[i])
    : [];
  const selectedChunkIds = selectedChunks.map((c) => c.chunk_id);

  // FIX: usa .eq("id", productId) invece di .eq("product_id", productId)
  const { data: productRow } = await supabase
    .from("products")
    .select("persona, domain, guardrails, language")
    .eq("id", productId)
    .single();

  const productConfig = productRow ?? {};
  const orchestratorSystem = buildOrchestratorPrompt(productConfig);

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
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") ?? "";
  } catch (err) {
    console.error("[chat] Orchestrator error:", err);
    return NextResponse.json({ error: "Errore Orchestrator" }, { status: 502 });
  }

  try {
    await supabase.from("audit_log").insert({
      user_id: user.id, product_id: productId, question, answer, chunks_used: selectedChunkIds,
    });
  } catch (err) {
    console.warn("[chat] Audit log insert failed:", err);
  }

  return NextResponse.json({ answer, sources: selectedChunkIds });
}
