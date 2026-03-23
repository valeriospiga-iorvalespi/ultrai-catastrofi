// app/api/conversations/[id]/route.ts
// PATCH  /api/conversations/[id]  → aggiorna titolo
// DELETE /api/conversations/[id]  → elimina conversazione

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  let body: { title?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body non valido" }, { status: 400 }); }

  const { data, error: dbError } = await supabase
    .from("conversations")
    .update({
      title: body.title?.trim() || "Nuova chat",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", user.id) // sicurezza: solo le proprie
    .select("id, title, updated_at")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { error: dbError } = await supabase
    .from("conversations")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id); // sicurezza: solo le proprie

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
