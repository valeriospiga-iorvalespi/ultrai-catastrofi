// app/api/admin/config/route.ts
// GET  /api/admin/config?productId=uuid  → legge persona/domain/guardrails/language
// POST /api/admin/config                 → salva { productId, persona, domain, guardrails, language }

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

async function checkAdmin(request: NextRequest, supabase: ReturnType<typeof makeClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId obbligatorio" }, { status: 400 });

  const supabase = makeClient(request);
  if (!(await checkAdmin(request, supabase))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("products")
    .select("persona, domain, guardrails, language")
    .eq("id", productId)
    .single();

  if (error) return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = makeClient(request);
  if (!(await checkAdmin(request, supabase))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  let body: { productId: string; persona?: string; domain?: string; guardrails?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const { productId, persona, domain, guardrails, language } = body;
  if (!productId) return NextResponse.json({ error: "productId obbligatorio" }, { status: 400 });

  const { error } = await supabase
    .from("products")
    .update({
      persona: persona ?? null,
      domain: domain ?? null,
      guardrails: guardrails ?? null,
      language: language ?? null,
    })
    .eq("id", productId);

  if (error) {
    console.error("[config] update error:", error);
    return NextResponse.json({ error: "Salvataggio fallito" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
