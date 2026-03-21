// app/page.tsx — redirect homepage to /chat
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/chat");
}
