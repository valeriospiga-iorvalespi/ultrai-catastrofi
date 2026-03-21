// app/api/admin/chunks/route.ts
// GET  /api/admin/chunks?productId=uuid  → lista chunk
// DELETE /api/admin/chunks/[id] → elimina chunk (gestito in route separata)

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
  if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const productId = new URL(request.url).searchParams.get("productId");

  let query = supabase
    .from("chunks")
    .select("id, chunk_id, heading, section, article, tokens, created_at, product_id")
    .order("created_at", { ascending: true });

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ chunks: data ?? [] });
}
