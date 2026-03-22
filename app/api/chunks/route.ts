/**
 * app/api/chunks/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/chunks?ids=chunk-id-1,chunk-id-2&productId=uuid
 *
 * Usata da ChatArea per recuperare il testo completo dei chunk da mostrare
 * nel pannello "Fonti" dopo una risposta dell'orchestratore.
 * Richiede che l'utente sia autenticato.
 * ─────────────────────────────────────────────────────────────────────────────
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

  // Verifica autenticazione
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

  // Separa e sanifica la lista di chunk_id
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10); // max 10 chunk per richiesta

  if (ids.length === 0) {
    return NextResponse.json({ chunks: [] });
  }

  const { data, error } = await supabase
    .from("chunks")
    .select("chunk_id, heading, text, section, article")
    .eq("product_id", productId)
    .in("chunk_id", ids);

  if (error) {
    console.error("[chunks] DB error:", error);
    return NextResponse.json({ error: "Errore database" }, { status: 500 });
  }

  // Mantieni l'ordine originale degli ids richiesti
  const ordered = ids
    .map((id) => (data ?? []).find((c) => c.chunk_id === id))
    .filter(Boolean);

  return NextResponse.json({ chunks: ordered });
}
