// app/api/conversations/route.ts
// GET  /api/conversations?productId=uuid  → lista conversazioni utente
// POST /api/conversations                 → crea nuova conversazione

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const productId = new URL(request.url).searchParams.get("productId");

  let query = supabase
    .from("conversations")
    .select("id, title, product_id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (productId) query = query.eq("product_id", productId);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  let body: { title?: string; product_id?: string };
  try { body = await request.json(); }
  catch { body = {}; }

  const { data, error: dbError } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      product_id: body.product_id ?? null,
      title: body.title?.trim() || "Nuova chat",
    })
    .select("id, title, product_id, created_at, updated_at")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
