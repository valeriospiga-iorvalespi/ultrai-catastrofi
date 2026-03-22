/**
 * app/api/admin/upload/route.ts
 * Supporta due modalità:
 *   mode=replace  → elimina chunk esistenti poi inserisce (default precedente)
 *   mode=append   → aggiunge chunk senza eliminare quelli esistenti
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { chunkDocxBuffer } from "@/lib/chunker";
import type { Chunk } from "@/lib/chunker";

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

async function insertChunksBatch(
  supabase: ReturnType<typeof createServerClient>,
  productId: string,
  chunks: Chunk[],
  existingIds: Set<string>
): Promise<{ inserted: number; skipped: number }> {
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;

  // In modalità append, deduplica per chunk_id per evitare conflitti
  const toInsert = chunks.filter((c) => {
    if (existingIds.has(c.id)) { skipped++; return false; }
    return true;
  });

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const rows = batch.map((c) => ({
      chunk_id: c.id,
      product_id: productId,
      section: c.section,
      article: c.article,
      heading: c.heading,
      text: c.text,
      tokens: c.tokens,
      note: null as string | null,
    }));
    const { error } = await supabase.from("chunks").insert(rows);
    if (error) throw new Error(`Batch insert fallito (offset ${i}): ${error.message}`);
    inserted += batch.length;
  }

  return { inserted, skipped };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "FormData non valida" }, { status: 400 }); }

  const file = formData.get("file");
  const productId = formData.get("productId");
  const mode = (formData.get("mode") as string) ?? "replace"; // "replace" | "append"

  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "Campo 'file' mancante o non valido" }, { status: 400 });
  if (!productId || typeof productId !== "string" || !productId.trim())
    return NextResponse.json({ error: "Campo 'productId' mancante" }, { status: 400 });

  const productIdStr = productId.trim();
  const supabase = makeSupabaseClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (user.email !== process.env.ADMIN_EMAIL)
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });

  const fileName = file.name ?? "";
  if (!fileName.toLowerCase().endsWith(".docx"))
    return NextResponse.json({ error: "Solo file .docx sono accettati" }, { status: 400 });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    console.error("[upload] Lettura file:", err);
    return NextResponse.json({ error: "Lettura file fallita" }, { status: 500 });
  }

  let chunks: Chunk[];
  try {
    chunks = await chunkDocxBuffer(buffer);
  } catch (err) {
    console.error("[upload] chunkDocxBuffer:", err);
    return NextResponse.json({ error: "Elaborazione documento fallita" }, { status: 422 });
  }

  if (chunks.length === 0)
    return NextResponse.json({ error: "Nessun chunk estratto dal documento" }, { status: 422 });

  // ── MODALITÀ REPLACE: elimina chunk esistenti ──────────────────────────────
  if (mode === "replace") {
    const { error: deleteError } = await supabase
      .from("chunks").delete().eq("product_id", productIdStr);
    if (deleteError) {
      console.error("[upload] DELETE chunks:", deleteError);
      return NextResponse.json({ error: "Eliminazione chunk precedenti fallita" }, { status: 500 });
    }
  }

  // ── CARICA chunk_id esistenti per deduplicazione in append ────────────────
  let existingIds = new Set<string>();
  if (mode === "append") {
    const { data: existing } = await supabase
      .from("chunks")
      .select("chunk_id")
      .eq("product_id", productIdStr);
    existingIds = new Set((existing ?? []).map((r) => r.chunk_id));
  }

  // ── INSERIMENTO ────────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped = 0;
  try {
    const result = await insertChunksBatch(supabase, productIdStr, chunks, existingIds);
    inserted = result.inserted;
    skipped = result.skipped;
  } catch (err) {
    console.error("[upload] INSERT chunks:", err);
    if (mode === "replace") {
      await supabase.from("chunks").delete().eq("product_id", productIdStr);
    }
    return NextResponse.json({ error: "Inserimento chunk fallito." }, { status: 500 });
  }

  // ── STORAGE ────────────────────────────────────────────────────────────────
  const storageKey = `${productIdStr}/${Date.now()}_${fileName}`;
  const { error: storageError } = await supabase.storage
    .from("normativo")
    .upload(storageKey, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (storageError) console.warn("[upload] Storage upload fallito:", storageError);

  // ── AGGIORNA products ──────────────────────────────────────────────────────
  // In append, incrementa chunk_count; in replace, imposta il valore esatto
  if (mode === "replace") {
    await supabase.from("products").update({
      last_upload_at: new Date().toISOString(),
      last_file_name: fileName,
      chunk_count: chunks.length,
    }).eq("id", productIdStr);
  } else {
    // Recupera chunk_count attuale e aggiorna
    const { data: prod } = await supabase
      .from("products").select("chunk_count").eq("id", productIdStr).single();
    const newCount = (prod?.chunk_count ?? 0) + inserted;
    await supabase.from("products").update({
      last_upload_at: new Date().toISOString(),
      last_file_name: fileName,
      chunk_count: newCount,
    }).eq("id", productIdStr);
  }

  return NextResponse.json({
    success: true,
    count: inserted,
    skipped,
    mode,
    ...(storageError ? { warning: "File originale non salvato su Storage" } : {}),
  });
}
