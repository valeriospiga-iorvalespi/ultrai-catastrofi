import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UltrAI Catastrofi naturali Impresa",
  description: "Assistente virtuale per agenti Allianz",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body style={{ margin: 0, padding: 0, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
