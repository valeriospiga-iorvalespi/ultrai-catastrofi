// app/chat/ChatShell.tsx — responsive
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Sidebar, {
  Conversation,
  loadHistory,
  saveHistory,
  deleteMessages,
  deleteAllHistory,
} from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface ChatShellProps {
  userName: string;
}

export default function ChatShell({ userName }: ChatShellProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const isNarrow = isMobile || isTablet;

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<"profilo" | "impostazioni" | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Chiudi sidebar mobile quando si seleziona una chat
  const handleSelect = (id: string) => {
    setActiveId(id);
    if (isNarrow) setSidebarOpen(false);
  };

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
    if (isNarrow) setSidebarOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteMessages(id);
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveHistory(updated);
      if (activeId === id) {
        if (updated.length > 0) {
          setActiveId(updated[0].id);
        } else {
          const newConv: Conversation = {
            id: `conv_${Date.now()}`,
            title: "Nuova chat",
            updatedAt: new Date().toISOString(),
          };
          saveHistory([newConv]);
          setActiveId(newConv.id);
          return [newConv];
        }
      }
      return updated;
    });
  };

  const handleDeleteAll = () => {
    deleteAllHistory();
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: "Nuova chat",
      updatedAt: new Date().toISOString(),
    };
    saveHistory([newConv]);
    setConversations([newConv]);
    setActiveId(newConv.id);
  };

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
    window.location.href = "/login";
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

  // Chiudi sidebar mobile al resize verso desktop
  useEffect(() => {
    if (!isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  // ✅ FIX: chiudi menu cliccando fuori — senza overlay che blocca i bottoni
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    // Usa setTimeout per evitare che il click che apre il menu lo richiuda subito
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [menuOpen]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buona sera";
  const firstName = userName.split(" ")[0];

  const menuItems = [
    { label: "👤 Profilo", action: () => { setModal("profilo"); setMenuOpen(false); } },
    { label: "⚙️ Impostazioni", action: () => { setModal("impostazioni"); setMenuOpen(false); } },
    { label: "📊 Admin", action: () => { setMenuOpen(false); window.location.href = "/admin"; } },
    { label: "🚪 Esci", action: () => { setMenuOpen(false); handleLogout(); }, danger: true as const },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: "48px 1fr 44px",
      height: "100dvh", // dvh per mobile (evita il problema con la barra URL)
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden",
    }}>

      {/* ─── HEADER ─── */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        padding: isMobile ? "0 12px" : "0 20px",
        gap: isMobile ? 8 : 12,
        zIndex: 10,
      }}>

        {/* Hamburger — solo mobile/tablet */}
        {isNarrow && (
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              background: sidebarOpen ? "#f0f0f0" : "none",
              border: "none", borderRadius: 6, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, fontSize: 18, color: "#5a6a85",
              zIndex: 101,
            }}>
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}

        {/* Logo + titolo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Image src="/allianz-logo.png" alt="Allianz" width={28} height={28}
            style={{ objectFit: "contain", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span style={{
            fontWeight: 600,
            fontSize: isMobile ? 13 : 15,
            color: "#003781",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {isMobile ? "UltrAI CNI" : "UltrAI Catastrofi naturali Impresa"}
          </span>
          {!isMobile && (
            <span style={{ background: "#e8f0fb", color: "#003781", borderRadius: 4,
              padding: "2px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>BETA</span>
          )}
        </div>

        {/* Saluto + menu */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, flexShrink: 0 }}>
          {!isMobile && (
            <span style={{ fontSize: 13.5, color: "#5a6a85", whiteSpace: "nowrap" }}>
              {greeting},{" "}
              <strong style={{ color: "#2c3e50", fontWeight: 600 }}>{firstName}</strong>
            </span>
          )}

          <div style={{ position: "relative" }} ref={menuRef}>
            <button onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: menuOpen ? "#f0f0f0" : "none", border: "none", borderRadius: 6,
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 18, color: "#5a6a85", letterSpacing: "0.05em",
                position: "relative", zIndex: 101,
              }}>
              •••
            </button>

            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 4px)",
                background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 180, zIndex: 101, overflow: "hidden",
              }}>
                {isMobile && (
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0",
                    fontSize: 13, color: "#5a6a85" }}>
                    {greeting}, <strong style={{ color: "#2c3e50" }}>{firstName}</strong>
                  </div>
                )}
                {menuItems.map((item) => (
                  <button key={item.label} onClick={item.action}
                    style={{
                      width: "100%", background: "none", border: "none", padding: "10px 16px",
                      textAlign: "left", fontSize: 13.5, cursor: "pointer",
                      color: "danger" in item && item.danger ? "#c0392b" : "#2c3e50",
                      borderTop: item.label === "🚪 Esci" ? "1px solid #f0f0f0" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── BODY ─── */}
      <div style={{ display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Overlay mobile per chiudere sidebar */}
        {isNarrow && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "absolute", inset: 0, zIndex: 49,
              background: "rgba(0,0,0,0.35)",
            }}
          />
        )}

        {/* Sidebar — drawer su mobile, fissa su desktop */}
        <div style={{
          position: isNarrow ? "absolute" : "relative",
          left: isNarrow ? (sidebarOpen ? 0 : "-280px") : "auto",
          top: 0, bottom: 0,
          width: 260,
          zIndex: 50,
          transition: isNarrow ? "left 0.25s ease" : "none",
          flexShrink: 0,
        }}>
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onNew={handleNew}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onDeleteAll={handleDeleteAll}
          />
        </div>

        <ChatArea
          productId="a986fcdc-a745-4cc2-848c-165477b1fbf3"
          conversationId={activeId ?? undefined}
          onConversationUpdate={handleConversationUpdate}
          isMobile={isMobile}
        />
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{
        height: 44, background: "#003781",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderTop: "1px solid #002a63",
      }}>
        {(isMobile
          ? ["© Allianz Italia", "v1.0"]
          : ["© Allianz Italia S.p.A.", "Catastrofi naturali Impresa", "v1.0"]
        ).map((item, i, arr) => (
          <span key={item} style={{
            color: "rgba(255,255,255,0.75)", fontSize: isMobile ? 11 : 12,
            padding: "0 10px",
            borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none",
          }}>
            {item}
          </span>
        ))}
      </footer>

      {/* ─── MODAL PROFILO ─── */}
      {modal === "profilo" && (
        <>
          <div onClick={() => setModal(null)}
            style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.3)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12,
            padding: isMobile ? 20 : 28,
            width: isMobile ? "calc(100vw - 32px)" : "auto",
            minWidth: isMobile ? "auto" : 320,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#003781" }}>👤 Profilo</h3>
              <button onClick={() => setModal(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#003781",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#2c3e50" }}>{userName}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Agente Allianz</div>
              </div>
            </div>
            <button onClick={() => setModal(null)}
              style={{ width: "100%", background: "#003781", color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
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
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12,
            padding: isMobile ? 20 : 28,
            width: isMobile ? "calc(100vw - 32px)" : "auto",
            minWidth: isMobile ? "auto" : 340,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#003781" }}>⚙️ Impostazioni</h3>
              <button onClick={() => setModal(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { window.location.href = "/admin"; setModal(null); }}
                style={{ background: "#f8fafd", border: "1px solid #e8ecf0", borderRadius: 8,
                  padding: "12px 14px", textAlign: "left", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafd")}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#2c3e50" }}>📊 Pannello Admin</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Gestisci normativo e configurazione</div>
              </button>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
