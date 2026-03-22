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
  const [modal, setModal] = useState<"profilo" | "impostazioni" | null>(null);
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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buona sera";

  const firstName = userName.split(" ")[0];

  const menuItems = [
    {
      label: "👤 Profilo",
      action: () => { setModal("profilo"); setMenuOpen(false); },
    },
    {
      label: "⚙️ Impostazioni",
      action: () => { setModal("impostazioni"); setMenuOpen(false); },
    },
    {
      label: "📊 Admin",
      // ✅ FIX: usa window.location invece di router.push per evitare
      // interferenze con l'overlay che chiude il menu
      action: () => { setMenuOpen(false); setTimeout(() => router.push("/admin"), 50); },
    },
    {
      label: "🚪 Esci",
      action: () => { setMenuOpen(false); handleLogout(); },
      danger: true as const,
    },
  ];

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

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13.5, color: "#5a6a85" }}>
            {greeting},{" "}
            <strong style={{ color: "#2c3e50", fontWeight: 600 }}>{firstName}</strong>
          </span>

          {/* Menu 3 puntini */}
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
                position: "relative",
                zIndex: 101, // ✅ sopra l'overlay
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
                  zIndex: 101, // ✅ sopra l'overlay
                  overflow: "hidden",
                }}
              >
                {menuItems.map((item) => (
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

      {/* ─── BODY ─── */}
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

      {/* ─── FOOTER ─── */}
      <footer
        style={{
          height: 44,
          background: "#003781",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderTop: "1px solid #002a63",
        }}
      >
        {["© Allianz Italia S.p.A.", "Catastrofi naturali Impresa", "v1.0"].map((item, i) => (
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

      {/* ─── MODAL PROFILO ─── */}
      {modal === "profilo" && (
        <>
          <div onClick={() => setModal(null)}
            style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12, padding: 28, minWidth: 320,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#003781" }}>👤 Profilo</h3>
              <button onClick={() => setModal(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#003781",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#fff", fontWeight: 700 }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#2c3e50" }}>{userName}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Agente Allianz</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>Sessione attiva</div>
              <div style={{ fontSize: 13, color: "#2c3e50", fontFamily: "monospace",
                background: "#f5f7fa", padding: "6px 10px", borderRadius: 6 }}>
                {greeting}, {firstName}
              </div>
            </div>
            <button onClick={() => setModal(null)}
              style={{ marginTop: 20, width: "100%", background: "#003781", color: "#fff",
                border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14,
                fontWeight: 600, cursor: "pointer" }}>
              Chiudi
            </button>
          </div>
        </>
      )}

      {/* ─── MODAL IMPOSTAZIONI ─── */}
      {modal === "impostazioni" && (
        <>
          <div onClick={() => setModal(null)}
            style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12, padding: 28, minWidth: 340,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#003781" }}>⚙️ Impostazioni</h3>
              <button onClick={() => setModal(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  label: "📊 Pannello Admin",
                  desc: "Gestisci normativo e configurazione",
                  action: () => { router.push("/admin"); setModal(null); },
                },
                {
                  label: "🗑️ Cancella storico chat",
                  desc: "Rimuove tutte le conversazioni salvate localmente",
                  action: () => { localStorage.clear(); window.location.reload(); },
                },
              ].map((item) => (
                <button key={item.label} onClick={item.action}
                  style={{ background: "#f8fafd", border: "1px solid #e8ecf0", borderRadius: 8,
                    padding: "12px 14px", textAlign: "left", cursor: "pointer",
                    transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafd")}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#2c3e50" }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{item.desc}</div>
                </button>
              ))}
              <button onClick={() => { handleLogout(); setModal(null); }}
                style={{ background: "#fff0f0", border: "1px solid #f5c1c1", borderRadius: 8,
                  padding: "12px 14px", textAlign: "left", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe0e0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff0f0")}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#c0392b" }}>🚪 Esci</div>
                <div style={{ fontSize: 12, color: "#e07070", marginTop: 3 }}>Disconnetti l&apos;account corrente</div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ✅ FIX: overlay con zIndex 100, menu e bottone con zIndex 101
          così i click sui bottoni del menu non vengono intercettati */}
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
