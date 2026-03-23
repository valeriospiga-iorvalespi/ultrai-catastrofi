// app/api/admin/chunks/route.ts
// GET  /api/admin/chunks?productId=uuid  → lista chunk

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeClient(request: NextRequest) {
  // ✅ FIX: service role key bypassa RLS — corretto per admin API
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);

  // Verifica admin tramite session cookie
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Non autorizzato", detail: authError?.message },
      { status: 403 }
    );
  }

  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Non autorizzato — non sei admin", email: user.email },
      { status: 403 }
    );
  }

  const productId = new URL(request.url).searchParams.get("productId");

  let query = supabase
    .from("chunks")
    .select("id, chunk_id, heading, section, article, text, tokens, created_at, product_id")
    .order("created_at", { ascending: true });

  if (productId && productId !== "all") {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/chunks] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chunks: data ?? [], count: data?.length ?? 0 });
}
