// app/api/admin/products/route.ts
// GET /api/admin/products → lista prodotti con chunk_count

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

  // Carica prodotti
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, short_name, last_upload_at, chunk_count")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mappa nel formato atteso da AdminShell
  const mapped = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    chunk_count: p.chunk_count ?? 0,
    last_updated: p.last_upload_at ?? "-",
  }));

  return NextResponse.json({ products: mapped });
}
