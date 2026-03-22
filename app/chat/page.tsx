// app/chat/page.tsx  — Server Component
// ✅ FIX: usa getAll() invece di get() per evitare warning @supabase/ssr

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChatShell from "./ChatShell";

export default async function ChatPage() {
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
          // Server component: sola lettura, non serve settare
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const userName =
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "Utente";

  return <ChatShell userName={userName} />;
}
