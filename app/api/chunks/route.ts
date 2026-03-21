// app/api/chunks/route.ts
// GET /api/chunks?ids=chunk-id-1,chunk-id-2&productId=uuid

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  const productId = searchParams.get("productId");

  if (!idsParam || !productId) {
    return NextResponse.json({ error: "ids e productId obbligatori" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  const supabase = createServerClient(
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

  // Verifica auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Carica i chunk per chunk_id
  const { data: chunks, error } = await supabase
    .from("chunks")
    .select("chunk_id, heading, text, section")
    .eq("product_id", productId)
    .in("chunk_id", ids);

  if (error) {
    console.error("[chunks] DB error:", error);
    return NextResponse.json({ error: "Errore database" }, { status: 500 });
  }

  // Mantieni l'ordine originale degli ids
  const ordered = ids
    .map((id) => chunks?.find((c) => c.chunk_id === id))
    .filter(Boolean);

  return NextResponse.json({ chunks: ordered });
}
