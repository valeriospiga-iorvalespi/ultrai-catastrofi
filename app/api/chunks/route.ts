/**
 * app/api/chunks/route.ts
 * GET /api/chunks?ids=chunk-id-1,chunk-id-2&productId=uuid
 *
 * Recupera testo completo dei chunk per il pannello Fonti.
 * Se non trova chunk con product_id (es. chunk con prefisso errato),
 * fa un fallback cercando solo per chunk_id su tutti i prodotti.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  const productId = url.searchParams.get("productId");

  if (!idsParam || !productId) {
    return NextResponse.json({ error: "Parametri ids e productId obbligatori" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (ids.length === 0) {
    return NextResponse.json({ chunks: [] });
  }

  // ── 1. Cerca con product_id (caso normale) ────────────────────────────────
  const { data: primary, error } = await supabase
    .from("chunks")
    .select("chunk_id, heading, text, section, article")
    .eq("product_id", productId)
    .in("chunk_id", ids);

  if (error) {
    console.error("[chunks] DB error:", error);
    return NextResponse.json({ error: "Errore database" }, { status: 500 });
  }

  let results = primary ?? [];

  // ── 2. Fallback: cerca senza product_id per gli id non trovati ────────────
  const foundIds = new Set(results.map(c => c.chunk_id));
  const missingIds = ids.filter(id => !foundIds.has(id));

  if (missingIds.length > 0) {
    const { data: fallback } = await supabase
      .from("chunks")
      .select("chunk_id, heading, text, section, article")
      .in("chunk_id", missingIds);
    if (fallback?.length) {
      results = [...results, ...fallback];
    }
  }

  // Mantieni l'ordine originale
  const ordered = ids
    .map((id) => results.find((c) => c.chunk_id === id))
    .filter(Boolean);

  return NextResponse.json({ chunks: ordered });
}
