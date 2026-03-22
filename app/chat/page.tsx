// app/chat/page.tsx — Server Component
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
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // getUser() verifica lato server — più sicuro di getSession()
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name ||
    user.email.split("@")[0] ||
    "Utente";

  return <ChatShell userName={userName} />;
}
