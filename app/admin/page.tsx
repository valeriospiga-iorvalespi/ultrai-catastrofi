// app/admin/page.tsx  — Server Component con guard ADMIN_EMAIL
// ✅ FIX: usa getAll() + setAll() per evitare warning @supabase/ssr

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@allianz.it";

export default async function AdminPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server component: sola lettura
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");
  if (session.user.email !== ADMIN_EMAIL) redirect("/chat");

  return <AdminShell />;
}
