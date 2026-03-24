/**
 * app/api/admin/products/route.ts
 * GET  — lista tutti i prodotti (inclusi inattivi, per l'admin)
 * POST — crea nuovo prodotto
 * PATCH — rinomina o toggling active
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  );
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, short_name, chunk_count, last_upload_at, active")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((p) => ({
    id:           p.id,
    name:         p.name,
    short_name:   p.short_name ?? "",
    chunk_count:  p.chunk_count ?? 0,
    last_updated: p.last_upload_at ?? "-",
    active:       p.active ?? true,
  }));

  return NextResponse.json({ products });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, short_name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome prodotto obbligatorio" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ name: name.trim(), short_name: short_name?.trim() ?? null, active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, short_name, active } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Costruisce payload di update dinamicamente
  const update: Record<string, unknown> = {};
  if (name !== undefined)       update.name       = name;
  if (short_name !== undefined) update.short_name = short_name;
  if (active !== undefined)     update.active     = active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const { error } = await supabase.from("products").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
