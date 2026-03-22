// app/admin/page.tsx — Server Component con guard multipli
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

export default async function AdminPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // ✅ Usa getUser() non getSession() — getSession() si fida del cookie
  // senza riverificarlo con Supabase. getUser() fa una chiamata al server
  // e restituisce solo utenti realmente autenticati.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const adminEmail = process.env.ADMIN_EMAIL;

  // ✅ Controllo triplo: env var presente, email presente, email corrisponde
  if (!adminEmail) {
    console.error("[admin] ADMIN_EMAIL env var non configurata");
    redirect("/chat");
  }

  if (!user.email) {
    redirect("/chat");
  }

  // ✅ Confronto case-insensitive per sicurezza
  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    console.warn(`[admin] Accesso negato a ${user.email}`);
    redirect("/chat");
  }

  return <AdminShell />;
}
