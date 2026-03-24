// app/chat/ChatShell.tsx — v4: multi-LLM badge
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import ChatArea from "@/components/ChatArea";

interface ModelsInfo {
  retriever:    { provider: string; model: string };
  orchestrator: { provider: string; model: string };
}

interface ChatShellProps {
  userName: string;
}

interface Conversation {
  id: string;
  title: string;
  product_id: string | null;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  short_name: string | null;
  chunk_count: number;
}

export default function ChatShell({ userName }: ChatShellProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { isMobile, isTablet } = useBreakpoint();
  const isNarrow = isMobile || isTablet;
  const menuRef = useRef<HTMLDivElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState<"profilo" | "impostazioni" | null>(null);

  // Prodotti disponibili
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Conversazioni (da server)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Multi-LLM badge
  const [activeModels, setActiveModels] = useState<ModelsInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Carica prodotti ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => {
        const prods: Product[] = d.products ?? [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProductId(prods[0].id);
      })
      .catch(console.error);
  }, []);

  // ── Rileva se l'utente è admin ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/config?productId=probe")
      .then(r => { if (r.status !== 401) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  // ── Carica conversazioni dal server ───────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      const convs: Conversation[] = data.conversations ?? [];
      setConversations(convs);
      if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0].id);
        if (convs[0].product_id) setSelectedProductId(convs[0].product_id);
      }
    } catch (e) { console.error(e); }
    finally { setConvLoading(false); }
  }, [activeConvId]);

  useEffect(() => { fetchConversations(); }, []);

  // ── Chiudi menu cliccando fuori ────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [menuOpen]);

  useEffect(() => { if (!isNarrow) setSidebarOpen(false); }, [isNarrow]);

  // ── Nuova conversazione ────────────────────────────────────────────────
  const handleNew = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nuova chat", product_id: selectedProductId }),
      });
      const data = await res.json();
      const newConv: Conversation = data.conversation;
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      if (isNarrow) setSidebarOpen(false);
    } catch (e) { console.error(e); }
  };

  // ── Seleziona conversazione ────────────────────────────────────────────
  const handleSelect = (conv: Conversation) => {
    setActiveConvId(conv.id);
    if (conv.product_id) setSelectedProductId(conv.product_id);
    if (isNarrow) setSidebarOpen(false);
  };

  // ── Aggiorna titolo conversazione ──────────────────────────────────────
  const handleConversationUpdate = async (id: string, title: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c)
    );
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch (e) { console.error(e); }
  };

  // ── Elimina conversazione singola ──────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations(prev => {
        const updated = prev.filter(c => c.id !== id);
        if (activeConvId === id) {
          setActiveConvId(updated.length > 0 ? updated[0].id : null);
        }
        return updated;
      });
    } catch (e) { console.error(e); }
  };

  // ── Elimina tutte le conversazioni ────────────────────────────────────
  const handleDeleteAll = async () => {
    try {
      await Promise.all(conversations.map(c => fetch(`/api/conversations/${c.id}`, { method: "DELETE" })));
      setConversations([]);
      setActiveConvId(null);
      setConfirmDeleteAll(false);
      // Crea subito una nuova chat
      await handleNew();
    } catch (e) { console.error(e); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buona sera";
  const firstName = userName.split(" ")[0];
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Gruppi temporali
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const filtered = conversations.filter(c =>
    !query || c.title.toLowerCase().includes(query.toLowerCase())
  );
  const groups = [
    { label: "Oggi", items: filtered.filter(c => new Date(c.updated_at).toDateString() === today) },
    { label: "Ieri", items: filtered.filter(c => new Date(c.updated_at).toDateString() === yesterday) },
    { label: "Precedenti", items: filtered.filter(c => {
      const d = new Date(c.updated_at).toDateString();
      return d !== today && d !== yesterday;
    })},
  ].filter(g => g.items.length > 0);

  const menuItems = [
    { label: "👤 Profilo", action: () => { setModal("profilo"); setMenuOpen(false); } },
    { label: "⚙️ Impostazioni", action: () => { setModal("impostazioni"); setMenuOpen(false); } },
    { label: "📊 Admin", action: () => { setMenuOpen(false); window.location.href = "/admin"; } },
    { label: "🚪 Esci", action: () => { setMenuOpen(false); handleLogout(); }, danger: true as const },
  ];

  return (
    <div style={{ display: "grid", gridTemplateRows: "48px 1fr 44px", height: "100dvh",
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ─── HEADER ─── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e0e0e0",
        display: "flex", alignItems: "center", padding: isMobile ? "0 12px" : "0 20px",
        gap: isMobile ? 8 : 12, zIndex: 10 }}>

        {isNarrow && (
          <button onClick={() => setSidebarOpen(v => !v)}
            style={{ background: sidebarOpen ? "#f0f0f0" : "none", border: "none",
              borderRadius: 6, width: 36, height: 36, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18,
              color: "#5a6a85", zIndex: 101 }}>
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e30613",
            flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: isMobile ? 13 : 15, color: "#003781",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isMobile
              ? `UltrAI ${selectedProduct?.short_name ?? selectedProduct?.name ?? ""}`.trim()
              : `UltrAI ${selectedProduct?.name ?? ""}`}
          </span>
          {!isMobile && (
            <span style={{ background: "#e8f0fb", color: "#003781", borderRadius: 4,
              padding: "2px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>BETA</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, flexShrink: 0 }}>
          {/* ✅ Selezione prodotto */}
          {products.length > 1 && (
            <select
              value={selectedProductId}
              onChange={e => {
                setSelectedProductId(e.target.value);
                // Crea nuova chat sul prodotto selezionato
                setActiveConvId(null);
              }}
              style={{ border: "1px solid #d1d9e0", borderRadius: 6, padding: "4px 8px",
                fontSize: 12, color: "#003781", background: "#f0f6ff", outline: "none",
                cursor: "pointer", maxWidth: isMobile ? 120 : 200 }}>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.short_name ?? p.name}</option>
              ))}
            </select>
          )}

          {!isMobile && (
            <span style={{ fontSize: 13.5, color: "#5a6a85", whiteSpace: "nowrap" }}>
              {greeting},{" "}
              <strong style={{ color: "#2c3e50", fontWeight: 600 }}>{firstName}</strong>
            </span>
          )}

          <div style={{ position: "relative" }} ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ background: menuOpen ? "#f0f0f0" : "none", border: "none", borderRadius: 6,
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 18, color: "#5a6a85", letterSpacing: "0.05em",
                position: "relative", zIndex: 101 }}>
              •••
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)",
                background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 180, zIndex: 101, overflow: "hidden" }}>
                {isMobile && (
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0", fontSize: 13, color: "#5a6a85" }}>
                    {greeting}, <strong style={{ color: "#2c3e50" }}>{firstName}</strong>
                  </div>
                )}
                {menuItems.map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ width: "100%", background: "none", border: "none", padding: "10px 16px",
                      textAlign: "left", fontSize: 13.5, cursor: "pointer",
                      color: "danger" in item && item.danger ? "#c0392b" : "#2c3e50",
                      borderTop: item.label === "🚪 Esci" ? "1px solid #f0f0f0" : "none" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
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

        {/* Overlay mobile */}
        {isNarrow && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: "absolute", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.35)" }} />
        )}

        {/* ─── SIDEBAR ─── */}
        <aside style={{
          position: isNarrow ? "absolute" : "relative",
          left: isNarrow ? (sidebarOpen ? 0 : "-280px") : "auto",
          top: 0, bottom: 0, width: 260, zIndex: 50, flexShrink: 0,
          transition: isNarrow ? "left 0.25s ease" : "none",
          background: "#f9fafb", borderRight: "1px solid #e0e0e0",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Nuova chat */}
          <div style={{ padding: "12px 14px 8px" }}>
            <button onClick={handleNew}
              style={{ width: "100%", background: "#003781", color: "#fff", border: "none",
                borderRadius: 6, padding: "9px 14px", fontWeight: 600, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#0050b3")}
              onMouseLeave={e => (e.currentTarget.style.background = "#003781")}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuova chat
            </button>
          </div>

          {/* Ricerca */}
          <div style={{ padding: "4px 14px 10px" }}>
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Cerca chat…" value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e0e0e0",
                  borderRadius: 6, padding: "7px 10px 7px 32px", fontSize: 13, outline: "none",
                  background: "#fff", color: "#2c3e50" }} />
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
                color: "#9aa5b4", fontSize: 14, pointerEvents: "none" }}>🔍</span>
            </div>
          </div>

          {/* Lista conversazioni */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
            {convLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9aa5b4", fontSize: 13 }}>
                Caricamento…
              </div>
            ) : groups.length === 0 ? (
              <div style={{ padding: "24px 12px", textAlign: "center", color: "#9aa5b4", fontSize: 13 }}>
                Nessuna conversazione.<br />Inizia con una nuova chat.
              </div>
            ) : groups.map(group => (
              <div key={group.label} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9aa5b4", textTransform: "uppercase",
                  letterSpacing: "0.05em", padding: "6px 6px 4px" }}>{group.label}</div>
                {group.items.map(conv => (
                  <div key={conv.id}
                    onMouseEnter={() => setHoveredConvId(conv.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    style={{ position: "relative", display: "flex", alignItems: "center", borderRadius: 6,
                      background: activeConvId === conv.id ? "#f0f0f0" : "transparent" }}>
                    <button onClick={() => handleSelect(conv)} title={conv.title}
                      style={{ flex: 1, background: "none", border: "none",
                        padding: `8px 10px 8px 10px`,
                        paddingRight: hoveredConvId === conv.id ? 32 : 10,
                        textAlign: "left", cursor: "pointer", fontSize: 13,
                        fontWeight: activeConvId === conv.id ? 500 : 400,
                        color: "#2c3e50", whiteSpace: "nowrap", overflow: "hidden",
                        textOverflow: "ellipsis", display: "block" }}>
                      <span style={{ marginRight: 6, opacity: 0.5 }}>💬</span>
                      {conv.title}
                    </button>
                    {hoveredConvId === conv.id && (
                      <button onClick={e => { e.stopPropagation(); handleDelete(conv.id); }}
                        title="Elimina"
                        style={{ position: "absolute", right: 6, background: "none", border: "none",
                          cursor: "pointer", color: "#c0392b", fontSize: 14, padding: "4px 6px",
                          borderRadius: 4, lineHeight: 1, opacity: 0.7 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Footer sidebar */}
          <div style={{ borderTop: "1px solid #e0e0e0", padding: "10px 14px",
            background: "#f9fafb", display: "flex", flexDirection: "column", gap: 6 }}>
            {conversations.length > 0 && (
              confirmDeleteAll ? (
                <div style={{ background: "#fff0f0", border: "1px solid #ffbdbd", borderRadius: 6,
                  padding: "8px 10px", fontSize: 12 }}>
                  <div style={{ color: "#c0392b", fontWeight: 600, marginBottom: 6 }}>
                    Eliminare tutte le {conversations.length} chat?
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={handleDeleteAll}
                      style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 4,
                        padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Sì, elimina
                    </button>
                    <button onClick={() => setConfirmDeleteAll(false)}
                      style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 4,
                        padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#5a6a85" }}>
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteAll(true)}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#c0392b",
                    cursor: "pointer", padding: "2px 0", textAlign: "left", opacity: 0.7,
                    display: "flex", alignItems: "center", gap: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>
                  🗑 Cancella tutte le chat
                </button>
              )
            )}
            <div style={{ display: "flex", gap: 14 }}>
              {["❓ Aiuto", "🆕 Novità"].map(label => (
                <button key={label}
                  style={{ background: "none", border: "none", fontSize: 12.5, color: "#5a6a85",
                    cursor: "pointer", padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#003781")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#5a6a85")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── CHAT AREA ─── */}
        <ChatArea
          productId={selectedProductId}
          conversationId={activeConvId ?? undefined}
          onConversationUpdate={handleConversationUpdate}
          onNewConversation={handleNew}
          isMobile={isMobile}
          productName={selectedProduct?.name}
          productChunkCount={selectedProduct?.chunk_count ?? 0}
          activeModels={activeModels}
          isAdmin={isAdmin}
          onModelsUpdate={setActiveModels}
        />
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={{ height: 44, background: "#003781", display: "flex",
        alignItems: "center", justifyContent: "center", borderTop: "1px solid #002a63" }}>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
          Demo by Valerio Spiga
        </span>
      </footer>

      {/* ─── MODAL PROFILO ─── */}
      {modal === "profilo" && (
        <>
          <div onClick={() => setModal(null)}
            style={{ position: "fixed", inset: 0, zIndex: 299, background: "rgba(0,0,0,0.3)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12, padding: isMobile ? 20 : 28,
            width: isMobile ? "calc(100vw - 32px)" : "auto", minWidth: isMobile ? "auto" : 320,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
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
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Agente</div>
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
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 300, background: "#fff", borderRadius: 12, padding: isMobile ? 20 : 28,
            width: isMobile ? "calc(100vw - 32px)" : "auto", minWidth: isMobile ? "auto" : 340,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#003781" }}>⚙️ Impostazioni</h3>
              <button onClick={() => setModal(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { window.location.href = "/admin"; setModal(null); }}
                style={{ background: "#f8fafd", border: "1px solid #e8ecf0", borderRadius: 8,
                  padding: "12px 14px", textAlign: "left", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#e8f0fb")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f8fafd")}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#2c3e50" }}>📊 Pannello Admin</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>Gestisci normativo e configurazione</div>
              </button>
              <button onClick={() => { handleLogout(); setModal(null); }}
                style={{ background: "#fff0f0", border: "1px solid #f5c1c1", borderRadius: 8,
                  padding: "12px 14px", textAlign: "left", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#ffe0e0")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff0f0")}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#c0392b" }}>🚪 Esci</div>
                <div style={{ fontSize: 12, color: "#e07070", marginTop: 3 }}>Disconnetti l&apos;account corrente</div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
