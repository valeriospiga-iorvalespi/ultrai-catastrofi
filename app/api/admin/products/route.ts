// app/api/admin/products/route.ts
// GET   /api/admin/products           → lista tutti i prodotti
// POST  /api/admin/products           → crea nuovo prodotto
// PATCH /api/admin/products           → rinomina prodotto { id, name, short_name }

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeClient(request: NextRequest) {
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

async function checkAdmin(supabase: ReturnType<typeof makeClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(supabase)))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, short_name, last_upload_at, chunk_count")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    short_name: p.short_name ?? "",
    chunk_count: p.chunk_count ?? 0,
    last_updated: p.last_upload_at ?? "-",
  }));

  return NextResponse.json({ products: mapped });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(supabase)))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  let body: { name: string; short_name?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body non valido" }, { status: 400 }); }

  if (!body.name?.trim())
    return NextResponse.json({ error: "Il campo 'name' è obbligatorio" }, { status: 400 });

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: body.name.trim(),
      short_name: body.short_name?.trim() ?? null,
      chunk_count: 0,
    })
    .select("id, name, short_name, chunk_count")
    .single();

  if (error) {
    console.error("[products] INSERT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(supabase)))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  let body: { id: string; name?: string; short_name?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body non valido" }, { status: 400 }); }

  if (!body.id)
    return NextResponse.json({ error: "Il campo 'id' è obbligatorio" }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.short_name !== undefined) updates.short_name = body.short_name.trim() || null;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", body.id)
    .select("id, name, short_name, chunk_count")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ product: data });
}
