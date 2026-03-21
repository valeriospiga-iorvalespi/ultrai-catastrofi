/**
 * app/api/admin/upload/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { chunkDocxBuffer } from "@/lib/chunker";
import type { Chunk } from "@/lib/chunker";

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

async function insertChunksBatch(
  supabase: ReturnType<typeof createServerClient>,
  productId: string,
  chunks: Chunk[]
): Promise<void> {
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
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
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "FormData non valida" }, { status: 400 }); }

  const file = formData.get("file");
  const productId = formData.get("productId");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Campo \'file\' mancante o non valido" }, { status: 400 });
  }
  if (!productId || typeof productId !== "string" || !productId.trim()) {
    return NextResponse.json({ error: "Campo \'productId\' mancante" }, { status: 400 });
  }

  const productIdStr = productId.trim();

  const { supabase } = makeSupabaseClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "Configurazione server mancante" }, { status: 500 });
  }
  if (user.email !== adminEmail) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });
  }

  const fileName = file.name ?? "";
  if (!fileName.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Solo file .docx sono accettati" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
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

  if (chunks.length === 0) {
    return NextResponse.json({ error: "Nessun chunk estratto dal documento" }, { status: 422 });
  }

  const { error: deleteError } = await supabase
    .from("chunks").delete().eq("product_id", productIdStr);

  if (deleteError) {
    console.error("[upload] DELETE chunks:", deleteError);
    return NextResponse.json({ error: "Eliminazione chunk precedenti fallita" }, { status: 500 });
  }

  try {
    await insertChunksBatch(supabase, productIdStr, chunks);
  } catch (err) {
    console.error("[upload] INSERT chunks:", err);
    await supabase.from("chunks").delete().eq("product_id", productIdStr);
    return NextResponse.json({ error: "Inserimento chunk fallito. Nessun dato salvato." }, { status: 500 });
  }

  const storageKey = `${productIdStr}/${Date.now()}_${fileName}`;
  const { error: storageError } = await supabase.storage
    .from("normativo")
    .upload(storageKey, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (storageError) {
    console.warn("[upload] Storage upload fallito:", storageError);
  }

  // FIX: usa .update().eq("id") invece di upsert con product_id
  try {
    await supabase
      .from("products")
      .update({
        last_upload_at: new Date().toISOString(),
        last_file_name: fileName,
        chunk_count: chunks.length,
      })
      .eq("id", productIdStr);
  } catch (err) {
    console.warn("[upload] products update:", err);
  }

  return NextResponse.json({
    success: true,
    count: chunks.length,
    ...(storageError ? { warning: "File originale non salvato su Storage" } : {}),
  });
}
