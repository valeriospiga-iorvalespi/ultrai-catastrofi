// app/api/admin/chunks/[id]/route.ts
// DELETE /api/admin/chunks/[id]  → elimina chunk
// PATCH  /api/admin/chunks/[id]  → aggiorna metadati chunk (note, heading)

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

async function checkAdmin(request: NextRequest, supabase: ReturnType<typeof makeClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(request, supabase))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { error } = await supabase
    .from("chunks")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ✅ NUOVO: aggiorna note e/o heading di un chunk
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(request, supabase))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  let body: { note?: string; heading?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (body.note !== undefined) updates.note = body.note || null;
  if (body.heading !== undefined) updates.heading = body.heading;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chunks")
    .update(updates)
    .eq("id", params.id)
    .select("id, chunk_id, heading, note")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, chunk: data });
}
