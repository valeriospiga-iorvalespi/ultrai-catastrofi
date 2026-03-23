// app/api/conversations/[id]/messages/route.ts
// GET  /api/conversations/[id]/messages  → lista messaggi
// POST /api/conversations/[id]/messages  → aggiungi messaggio

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

async function checkOwnership(
  supabase: ReturnType<typeof makeClient>,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

// ✅ Next.js 16: params è una Promise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  if (!(await checkOwnership(supabase, id, user.id)))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  const { data, error: dbError } = await supabase
    .from("messages")
    .select("id, role, content, source_ids, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = makeClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  if (!(await checkOwnership(supabase, id, user.id)))
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });

  let body: { role: "user" | "assistant"; content: string; source_ids?: string[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Body non valido" }, { status: 400 }); }

  if (!body.role || !body.content)
    return NextResponse.json({ error: "role e content obbligatori" }, { status: 400 });

  const { data: msg, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      role: body.role,
      content: body.content,
      source_ids: body.source_ids ?? [],
    })
    .select("id, role, content, source_ids, created_at")
    .single();

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message: msg });
}
