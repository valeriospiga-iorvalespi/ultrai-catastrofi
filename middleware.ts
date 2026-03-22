// middleware.ts  — va messo nella ROOT del progetto (stesso livello di package.json)
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Crea client Supabase con i cookie della request
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Recupera utente verificato lato server
  const { data: { user } } = await supabase.auth.getUser();

  // ── Protezione /admin ──────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    // Non autenticato → login
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? "";

    // Email non corrisponde → chat (non admin)
    if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
      console.warn(`[middleware] Accesso admin negato: ${user.email}`);
      return NextResponse.redirect(new URL("/chat", request.url));
    }
  }

  // ── Protezione /chat e /api/chat ───────────────────────────────────────────
  if (pathname.startsWith("/chat") || pathname.startsWith("/api/chat")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── Redirect / → /chat o /login ───────────────────────────────────────────
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/chat", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/chat/:path*",
    "/admin/:path*",
    "/api/chat/:path*",
  ],
};
