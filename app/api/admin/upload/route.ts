/**
 * app/api/admin/upload/route.ts
 * Supporta due modalità:
 *   mode=replace  → elimina chunk esistenti poi inserisce (default precedente)
 *   mode=append   → aggiunge chunk senza eliminare quelli esistenti
 *
 * Formati accettati: .docx  .md  .pdf
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { chunkDocxBuffer, chunkMarkdownBuffer } from "@/lib/chunker";
import type { Chunk } from "@/lib/chunker";

// ─── MIME type → content-type per lo Storage ────────────────────────────────

const CONTENT_TYPE: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md":   "text/markdown",
};

// ─── Supabase client ─────────────────────────────────────────────────────────

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

// ─── Insert batch ─────────────────────────────────────────────────────────────

async function insertChunksBatch(
  supabase: ReturnType<typeof createServerClient>,
  productId: string,
  chunks: Chunk[],
  existingIds: Set<string>
): Promise<{ inserted: number; skipped: number }> {
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;

  const toInsert = chunks.filter((c) => {
    if (existingIds.has(c.id)) { skipped++; return false; }
    return true;
  });

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const rows = batch.map((c) => ({
      chunk_id:   c.id,
      product_id: productId,
      section:    c.section,
      article:    c.article,
      heading:    c.heading,
      text:       c.text,
      tokens:     c.tokens,
      note:       null as string | null,
    }));
    const { error } = await supabase.from("chunks").insert(rows);
    if (error) throw new Error(`Batch insert fallito (offset ${i}): ${error.message}`);
    inserted += batch.length;
  }

  return { inserted, skipped };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Parse FormData ──────────────────────────────────────────────────────
  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "FormData non valida" }, { status: 400 }); }

  const file      = formData.get("file");
  const productId = formData.get("productId");
  const mode      = (formData.get("mode") as string) ?? "replace";

  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "Campo 'file' mancante o non valido" }, { status: 400 });
  if (!productId || typeof productId !== "string" || !productId.trim())
    return NextResponse.json({ error: "Campo 'productId' mancante" }, { status: 400 });

  const productIdStr = productId.trim();
  const fileName     = file.name ?? "";
  const ext          = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";

  // ── 2. Validazione estensione ──────────────────────────────────────────────
  const ALLOWED = [".docx", ".md"];
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json(
      { error: `Formato non supportato: ${ext || "(nessuno)"}. Accettati: ${ALLOWED.join(", ")}` },
      { status: 400 }
    );
  }

  // ── 3. Auth ────────────────────────────────────────────────────────────────
  const supabase = makeSupabaseClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (user.email !== process.env.ADMIN_EMAIL)
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });

  // ── 4. Leggi buffer ────────────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    console.error("[upload] Lettura file:", err);
    return NextResponse.json({ error: "Lettura file fallita" }, { status: 500 });
  }

  // ── 5. Chunking — dispatch per estensione ──────────────────────────────────
  let chunks: Chunk[];
  try {
    if (ext === ".docx") {
      chunks = await chunkDocxBuffer(buffer);
    } else {
      // .md
      chunks = await chunkMarkdownBuffer(buffer);
    }
  } catch (err) {
    console.error("[upload] chunking:", err);
    const msg = err instanceof Error ? err.message : "Elaborazione documento fallita";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  if (chunks.length === 0)
    return NextResponse.json({ error: "Nessun chunk estratto dal documento" }, { status: 422 });

  // ── 6. Replace: elimina chunk esistenti ───────────────────────────────────
  if (mode === "replace") {
    const { error: deleteError } = await supabase
      .from("chunks").delete().eq("product_id", productIdStr);
    if (deleteError) {
      console.error("[upload] DELETE chunks:", deleteError);
      return NextResponse.json({ error: "Eliminazione chunk precedenti fallita" }, { status: 500 });
    }
  }

  // ── 7. Append: carica chunk_id esistenti per deduplicazione ───────────────
  let existingIds = new Set<string>();
  if (mode === "append") {
    const { data: existing } = await supabase
      .from("chunks").select("chunk_id").eq("product_id", productIdStr);
    existingIds = new Set((existing ?? []).map((r) => r.chunk_id));
  }

  // ── 8. Inserimento ─────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  try {
    const result = await insertChunksBatch(supabase, productIdStr, chunks, existingIds);
    inserted = result.inserted;
    skipped  = result.skipped;
  } catch (err) {
    console.error("[upload] INSERT chunks:", err);
    if (mode === "replace") {
      await supabase.from("chunks").delete().eq("product_id", productIdStr);
    }
    return NextResponse.json({ error: "Inserimento chunk fallito." }, { status: 500 });
  }

  // ── 9. Storage ─────────────────────────────────────────────────────────────
  const storageKey    = `${productIdStr}/${Date.now()}_${fileName}`;
  const contentType   = CONTENT_TYPE[ext] ?? "application/octet-stream";
  const { error: storageError } = await supabase.storage
    .from("normativo")
    .upload(storageKey, buffer, { contentType, upsert: true });
  if (storageError) console.warn("[upload] Storage upload fallito:", storageError);

  // ── 10. Aggiorna products ──────────────────────────────────────────────────
  if (mode === "replace") {
    await supabase.from("products").update({
      last_upload_at:   new Date().toISOString(),
      last_file_name:   fileName,
      chunk_count:      chunks.length,
      source_documents: JSON.stringify([fileName]),
    }).eq("id", productIdStr);
  } else {
    // Append: legge source_documents esistenti e aggiunge il nuovo file se non già presente
    const { data: prod } = await supabase
      .from("products")
      .select("chunk_count, source_documents")
      .eq("id", productIdStr)
      .single();
    const newCount = (prod?.chunk_count ?? 0) + inserted;
    const existing: string[] = Array.isArray(prod?.source_documents) ? prod.source_documents : [];
    const updatedDocs = existing.includes(fileName) ? existing : [...existing, fileName];
    await supabase.from("products").update({
      last_upload_at:   new Date().toISOString(),
      last_file_name:   fileName,
      chunk_count:      newCount,
      source_documents: JSON.stringify(updatedDocs),
    }).eq("id", productIdStr);
  }

  return NextResponse.json({
    success: true,
    count:   inserted,
    skipped,
    mode,
    format:  ext,
    ...(storageError ? { warning: "File originale non salvato su Storage" } : {}),
  });
}
