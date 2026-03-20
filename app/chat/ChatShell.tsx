// app/chat/ChatShell.tsx — Client Component
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Sidebar, {
  Conversation,
  loadHistory,
  saveHistory,
} from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";

interface ChatShellProps {
  userName: string;
}

export default function ChatShell({ userName }: ChatShellProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleNew = () => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: "Nuova chat",
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => {
      const updated = [newConv, ...prev];
      saveHistory(updated);
      return updated;
    });
    setActiveId(newConv.id);
  };

  const handleSelect = (id: string) => setActiveId(id);

  const handleConversationUpdate = (id: string, title: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
      );
      saveHistory(updated);
      return updated;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Carica storico al mount, o crea prima chat se vuoto
  useEffect(() => {
    const history = loadHistory();
    if (history.length > 0) {
      setConversations(history);
      setActiveId(history[0].id);
    } else {
      const newConv: Conversation = {
        id: `conv_${Date.now()}`,
        title: "Nuova chat",
        updatedAt: new Date().toISOString(),
      };
      setConversations([newConv]);
      saveHistory([newConv]);
      setActiveId(newConv.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Formatta saluto in base all'ora
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buona sera";

  const firstName = userName.split(" ")[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "48px 1fr 44px",
        height: "100vh",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ─── HEADER ─── */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          zIndex: 10,
        }}
      >
        {/* Logo + Titolo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <Image
            src="/allianz-logo.png"
            alt="Allianz"
            width={30}
            height={30}
            style={{ objectFit: "contain" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 15, color: "#003781" }}>
            UltrAI Catastrofi naturali Impresa
          </span>
          <span
            style={{
              background: "#e8f0fb",
              color: "#003781",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              marginLeft: 4,
            }}
          >
            BETA
          </span>
        </div>

        {/* Destra: saluto + menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13.5, color: "#5a6a85" }}>
            {greeting},{" "}
            <strong style={{ color: "#2c3e50", fontWeight: 600 }}>{firstName}</strong>
          </span>

          {/* 3 puntini */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: menuOpen ? "#f0f0f0" : "none",
                border: "none",
                borderRadius: 6,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 18,
                color: "#5a6a85",
                letterSpacing: "0.05em",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "#f0f0f0")
              }
              onMouseLeave={(e) => {
                if (!menuOpen)
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
              }}
            >
              •••
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  background: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: 180,
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {[
                  { label: "👤 Profilo", action: () => setMenuOpen(false) },
                  { label: "⚙️ Impostazioni", action: () => setMenuOpen(false) },
                  { label: "📊 Admin", action: () => { router.push("/admin"); setMenuOpen(false); } },
                  { label: "🚪 Esci", action: handleLogout, danger: true as const },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 13.5,
                      cursor: "pointer",
                      color: "danger" in item && item.danger ? "#c0392b" : "#2c3e50",
                      borderTop: item.label === "🚪 Esci" ? "1px solid #f0f0f0" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "none")
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── BODY: Sidebar + ChatArea ─── */}
      <div style={{ display: "flex", overflow: "hidden" }}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onNew={handleNew}
          onSelect={handleSelect}
        />
        <ChatArea
          productId="a986fcdc-a745-4cc2-848c-165477b1fbf3"
          conversationId={activeId ?? undefined}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>

      {/* ─── FOOTER BAR ─── */}
      <footer
        style={{
          height: 44,
          background: "#003781",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          borderTop: "1px solid #002a63",
        }}
      >
        {[
          "© Allianz Italia S.p.A.",
          "Catastrofi naturali Impresa",
          "v1.0",
        ].map((item, i) => (
          <span
            key={item}
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 12,
              padding: "0 14px",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.2)" : "none",
            }}
          >
            {item}
          </span>
        ))}
      </footer>

      {/* Chiudi menu cliccando fuori */}
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
