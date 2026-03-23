// components/ChatArea.tsx — v3: messaggi da server, WelcomeBox dinamico
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceIds?: string[];
  timestamp: Date;
}

interface ChunkDetail {
  chunk_id: string;
  heading: string;
  text: string;
  section?: string;
}

interface ChatAreaProps {
  productId: string;
  conversationId?: string;
  onConversationUpdate?: (id: string, title: string) => void;
  onNewConversation?: () => void;
  isMobile?: boolean;
  productName?: string;       // ✅ NUOVO: nome prodotto dinamico
  productChunkCount?: number; // ✅ NUOVO: numero chunk per WelcomeBox
}

// ─── WelcomeBox dinamico ────────────────────────────────────────────────────

interface WelcomeBoxProps {
  productName: string;
  chunkCount: number;
  isMobile: boolean;
  onSelectQuestion: (q: string) => void;
}

function WelcomeBox({ productName, chunkCount, isMobile, onSelectQuestion }: WelcomeBoxProps) {
  const DOMANDE = [
    "Cosa copre la garanzia alluvione?",
    "Qual è la franchigia per terremoto?",
    "Come si denuncia un sinistro?",
    "Sono escluse le inondazioni costiere?",
  ];

  return (
    <div style={{ background: "#e8f0fb", borderRadius: 10,
      padding: isMobile ? "14px 16px" : "18px 22px", marginBottom: 24, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#003781",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z"
              fill="white" opacity="0.9" />
          </svg>
        </div>
        <div>
          {/* ✅ Nome prodotto dinamico */}
          <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: "#003781" }}>
            UltrAI — {productName}
          </div>
          <div style={{ fontSize: 12, color: "#5a6a85" }}>Assistente AI per consulenza sul prodotto</div>
        </div>
      </div>

      {/* Descrizione */}
      <p style={{ fontSize: isMobile ? 13 : 13.5, color: "#2c3e50", lineHeight: 1.55, margin: "0 0 12px 0" }}>
        Posso aiutarti a rispondere a domande sulla polizza{" "}
        <strong>{productName}</strong> di Allianz: garanzie, massimali, franchigie,
        procedure di sinistro ed esclusioni. Le risposte si basano esclusivamente
        sulla documentazione di prodotto ufficiale.
      </p>

      {/* Avviso */}
      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6,
        padding: "7px 12px", fontSize: 12, color: "#856404", marginBottom: 12,
        display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <span>Le risposte hanno scopo informativo. In caso di sinistro riferirsi sempre alle Condizioni di Assicurazione in vigore.</span>
      </div>

      {/* ✅ Fonti dinamiche */}
      {!isMobile && chunkCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6a85", marginBottom: 4,
            textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Documentazione indicizzata
          </div>
          <div style={{ fontSize: 12.5, color: "#2c3e50" }}>
            {chunkCount} chunk estratti dalla documentazione di prodotto
          </div>
        </div>
      )}

      {/* Domande suggerite */}
      <div style={{ marginTop: isMobile ? 8 : 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {(isMobile ? DOMANDE.slice(0, 2) : DOMANDE).map(q => (
          <button key={q} onClick={() => onSelectQuestion(q)}
            style={{ background: "#fff", border: "1px solid #b8c9e8", borderRadius: 20,
              padding: isMobile ? "6px 14px" : "5px 12px",
              fontSize: isMobile ? 13 : 12.5, color: "#003781", cursor: "pointer" }}
            onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = "#d8e6f8")}
            onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = "#fff")}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Render helpers ─────────────────────────────────────────────────────────

// ✅ Badge mostra numero progressivo [1], [2]… invece dello slug
function CitationBadge({ num, chunkId, onClick }: { num: number; chunkId: string; onClick: () => void }) {
  return (
    <span onClick={onClick} title={`Apri fonte: ${chunkId}`}
      style={{ display: "inline-block", background: "#fff3cd", border: "1px solid #ffc107",
        borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700, color: "#856404",
        cursor: "pointer", marginLeft: 2, marginRight: 2, verticalAlign: "middle" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#ffe69c")}
      onMouseLeave={e => (e.currentTarget.style.background = "#fff3cd")}>
      [{num}]
    </span>
  );
}

// ✅ Estrae tutti i chunk_id citati nel testo (in ordine di apparizione, deduplicati)
function extractCitedIds(text: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1].trim();
    if (!seen.has(id)) { seen.add(id); ordered.push(id); }
  }
  return ordered;
}

// Costruisce mappa chunkId → numero progressivo per una risposta
function buildCitationMap(text: string): Map<string, number> {
  const ids = extractCitedIds(text);
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i + 1));
  return map;
}

function renderInline(
  text: string,
  onCitation: (id: string) => void,
  key: string,
  citationMap: Map<string, number>
): React.ReactNode[] {
  return text.split(/(\{\{[^}]+\}\}|\*\*[^*]+\*\*)/g).map((part, i) => {
    const cite = part.match(/^\{\{([^}]+)\}\}$/);
    if (cite) {
      const id = cite[1].trim();
      const num = citationMap.get(id) ?? 0;
      return <CitationBadge key={`${key}-c${i}`} num={num} chunkId={id} onClick={() => onCitation(id)} />;
    }
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={`${key}-b${i}`}>{bold[1]}</strong>;
    return <React.Fragment key={`${key}-t${i}`}>{part}</React.Fragment>;
  });
}

function renderContent(
  text: string,
  onCitation: (id: string) => void,
  citationMap: Map<string, number>
): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let ki = 0;
  const flushList = () => {
    if (listItems.length) {
      nodes.push(<ul key={`ul-${ki++}`} style={{ margin: "6px 0 6px 18px", padding: 0 }}>{listItems}</ul>);
      listItems = [];
    }
  };
  lines.forEach((line, i) => {
    const k = `l-${i}`;
    if (/^##\s+/.test(line)) { flushList(); nodes.push(<div key={k} style={{ fontWeight: 700, fontSize: 14.5, color: "#003781", margin: "12px 0 4px" }}>{renderInline(line.replace(/^##\s+/, ""), onCitation, k, citationMap)}</div>); return; }
    if (/^###\s+/.test(line)) { flushList(); nodes.push(<div key={k} style={{ fontWeight: 600, fontSize: 13.5, color: "#2c3e50", margin: "8px 0 2px" }}>{renderInline(line.replace(/^###\s+/, ""), onCitation, k, citationMap)}</div>); return; }
    if (/^[-•]\s+/.test(line)) { listItems.push(<li key={k} style={{ marginBottom: 3, lineHeight: 1.55 }}>{renderInline(line.replace(/^[-•]\s+/, ""), onCitation, k, citationMap)}</li>); return; }
    if (!line.trim()) { flushList(); nodes.push(<div key={k} style={{ height: 6 }} />); return; }
    flushList();
    nodes.push(<div key={k} style={{ lineHeight: 1.6, marginBottom: 2 }}>{renderInline(line, onCitation, k, citationMap)}</div>);
  });
  flushList();
  return <>{nodes}</>;
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 16px",
      background: "#f5f7fa", border: "1px solid #e4e8ee", borderRadius: 10, width: "fit-content" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#003781",
          display: "inline-block", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

function SourcesPanel({ chunks, onClose, isMobile }: { chunks: ChunkDetail[]; onClose: () => void; isMobile?: boolean }) {
  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: isMobile ? "100vw" : 420,
      height: "100dvh", background: "#fff", borderLeft: "1px solid #e0e0e0", zIndex: 200,
      display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e0e0e0",
        display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafd" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#003781" }}>Fonti utilizzate</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{chunks.length} chunk dal normativo</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20,
          cursor: "pointer", color: "#888", padding: "4px 8px", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {chunks.length === 0 ? (
          <div style={{ padding: "24px 18px", color: "#aaa", fontSize: 13, textAlign: "center" }}>Nessuna fonte disponibile.</div>
        ) : chunks.map((c, i) => (
          <div key={c.chunk_id} style={{ padding: "12px 18px", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <span style={{ background: "#003781", color: "#fff", borderRadius: "50%", width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: "#003781", lineHeight: 1.4 }}>{c.heading}</div>
                {c.section && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{c.section}</div>}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.65, background: "#f8fafd",
              borderRadius: 6, padding: "10px 12px", border: "1px solid #e8f0fb",
              whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
              {c.text.replace(c.heading, "").trim()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bubble componenti ───────────────────────────────────────────────────────

function AssistantBubble({ message, onCopy, onExport, onShowSources, onCitationClick, isMobile }: {
  message: Message; onCopy: (t: string) => void; onExport: (t: string) => void;
  onShowSources: (ids: string[]) => void; onCitationClick: (id: string) => void; isMobile?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | "up" | "down">(null);
  const timeStr = message.timestamp.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // ✅ Calcola mappa chunk_id → numero progressivo basata sul testo
  const citationMap = buildCitationMap(message.content);

  // ✅ Solo i chunk effettivamente citati nel testo (non tutti i sourceIds recuperati)
  const citedIds = extractCitedIds(message.content);
  const hasCitations = citedIds.length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: "#f5f7fa", border: "1px solid #e4e8ee", borderRadius: 10,
        padding: isMobile ? "12px 14px" : "14px 18px", maxWidth: isMobile ? "100%" : "85%",
        fontSize: 14, lineHeight: 1.6, color: "#2c3e50", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: "#003781",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z" />
            </svg>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#003781" }}>UltrAI</span>
        </div>
        {renderContent(message.content, onCitationClick, citationMap)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, paddingLeft: 4, flexWrap: "wrap" }}>
        {/* ✅ Mostra solo le fonti citate nel testo */}
        {hasCitations && (
          <button onClick={() => onShowSources(citedIds)}
            style={{ background: "#e8f0fb", border: "1px solid #c5d8f5", borderRadius: 4,
              padding: "3px 8px", fontSize: 11.5, color: "#003781", fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#d0e4f7")}
            onMouseLeave={e => (e.currentTarget.style.background = "#e8f0fb")}>
            📄 {citedIds.length} {citedIds.length === 1 ? "fonte" : "fonti"} →
          </button>
        )}
        <span style={{ fontSize: 11.5, color: "#9aa5b4" }}>{timeStr}</span>
        <div style={{ flex: 1 }} />
        {[
          { label: copied ? "✓" : "📋", action: () => { onCopy(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }, active: copied },
          { label: "⬇️", action: () => onExport(message.content), active: false },
          { label: "👍", action: () => setLiked(liked === "up" ? null : "up"), active: liked === "up" },
          { label: "👎", action: () => setLiked(liked === "down" ? null : "down"), active: liked === "down" },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            style={{ background: btn.active ? "#e8f0fb" : "none", border: "none", borderRadius: 4,
              padding: "3px 8px", fontSize: 14, color: btn.active ? "#003781" : "#9aa5b4", cursor: "pointer",
              minWidth: 32, minHeight: 32 }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ message, isMobile }: { message: Message; isMobile?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{ background: "#003781", color: "#fff", borderRadius: "18px 18px 4px 18px",
        padding: isMobile ? "10px 14px" : "10px 16px",
        maxWidth: isMobile ? "88%" : "70%", fontSize: 14, lineHeight: 1.5,
        boxShadow: "0 2px 8px rgba(0,55,129,0.18)" }}>
        {message.content}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ChatArea({
  productId, conversationId, onConversationUpdate, onNewConversation,
  isMobile = false, productName = "Prodotto", productChunkCount = 0,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sourcesPanel, setSourcesPanel] = useState<ChunkDetail[] | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevConvId = useRef<string | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, isMobile ? 120 : 160) + "px";
  }, [inputText, isMobile]);

  // ✅ Carica messaggi dal SERVER quando cambia conversazione
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      prevConvId.current = null;
      return;
    }
    if (prevConvId.current === conversationId) return;
    prevConvId.current = conversationId;

    setMessagesLoading(true);
    setMessages([]);
    fetch(`/api/conversations/${conversationId}/messages`)
      .then(r => r.json())
      .then(data => {
        const msgs: Message[] = (data.messages ?? []).map((m: {
          id: string; role: "user" | "assistant"; content: string;
          source_ids?: string[]; created_at: string;
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sourceIds: m.source_ids ?? [],
          timestamp: new Date(m.created_at),
        }));
        setMessages(msgs);
      })
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }, [conversationId]);

  const handleShowSources = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setLoadingSources(true); setSourcesPanel([]);
    try {
      const res = await fetch(`/api/chunks?ids=${ids.join(",")}&productId=${productId}`);
      if (res.ok) { const d = await res.json(); setSourcesPanel(d.chunks || []); }
      else { setSourcesPanel(ids.map(id => ({ chunk_id: id, heading: id, text: "Testo non disponibile." }))); }
    } catch { setSourcesPanel(ids.map(id => ({ chunk_id: id, heading: id, text: "Errore." }))); }
    finally { setLoadingSources(false); }
  }, [productId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading || !productId) return;

    // Se non c'è una conversazione attiva, crea una nuova
    let convId = conversationId;
    if (!convId) {
      onNewConversation?.();
      return; // La nuova chat sarà creata da ChatShell, poi l'utente riprova
    }

    const userMsg: Message = {
      id: `temp-${Date.now()}`, role: "user", content: text, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    // Aggiorna titolo se è il primo messaggio
    if (messages.length === 0 && onConversationUpdate) {
      onConversationUpdate(convId, text.slice(0, 50));
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          productId,
          conversationId: convId, // ✅ passa al backend per salvare su DB
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: `temp-${Date.now() + 1}`, role: "assistant",
        content: data.answer || "Mi dispiace, non ho trovato una risposta pertinente.",
        sourceIds: data.sources ?? [],
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `temp-${Date.now() + 1}`, role: "assistant",
        content: "Errore di connessione. Riprova tra qualche istante.", timestamp: new Date(),
      }]);
    } finally { setLoading(false); }
  }, [inputText, loading, messages, productId, conversationId, onConversationUpdate, onNewConversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text).catch(console.error);

  const handleExport = (text: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>UltrAI</title>
      <style>body{font-family:sans-serif;max-width:700px;margin:40px auto;line-height:1.7}
      pre{white-space:pre-wrap;background:#f5f7fa;padding:16px;border-radius:8px}</style>
      </head><body><h2>UltrAI — ${productName}</h2>
      <p><strong>Data:</strong> ${new Date().toLocaleString("it-IT")}</p>
      <pre>${text}</pre></body></html>`);
    w.document.close(); w.print();
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
      background: "#fff", minWidth: 0 }}>

      {/* Pannello fonti */}
      {sourcesPanel !== null && (
        <>
          <div onClick={() => setSourcesPanel(null)}
            style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.15)" }} />
          {loadingSources ? (
            <div style={{ position: "fixed", top: 0, right: 0, width: isMobile ? "100vw" : 420,
              height: "100dvh", background: "#fff", borderLeft: "1px solid #e0e0e0", zIndex: 200,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#888", fontSize: 14 }}>Caricamento fonti…</span>
            </div>
          ) : (
            <SourcesPanel chunks={sourcesPanel} onClose={() => setSourcesPanel(null)} isMobile={isMobile} />
          )}
        </>
      )}

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "24px 32px" }}>
        {messagesLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9aa5b4", fontSize: 14 }}>
            Caricamento messaggi…
          </div>
        ) : (
          <>
            {/* ✅ WelcomeBox dinamico — mostrato solo se non ci sono messaggi */}
            {messages.length === 0 && (
              <WelcomeBox
                productName={productName}
                chunkCount={productChunkCount}
                isMobile={isMobile}
                onSelectQuestion={setInputText}
              />
            )}
            {messages.map(msg =>
              msg.role === "user"
                ? <UserBubble key={msg.id} message={msg} isMobile={isMobile} />
                : <AssistantBubble key={msg.id} message={msg} isMobile={isMobile}
                    onCopy={handleCopy} onExport={handleExport}
                    onShowSources={handleShowSources}
                    onCitationClick={id => handleShowSources([id])} />
            )}
            {loading && <div style={{ marginBottom: 12 }}><TypingIndicator /></div>}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid #e0e0e0", padding: isMobile ? "10px 12px 12px" : "12px 24px 14px",
        background: "#fff" }}>
        <div style={{ border: "1px solid #c8d4e8", borderRadius: 10, overflow: "hidden" }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = "#003781")}
          onBlurCapture={e => (e.currentTarget.style.borderColor = "#c8d4e8")}>
          <textarea ref={textareaRef} value={inputText}
            onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={`Fai una domanda sulla polizza…`}
            rows={1}
            style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none",
              resize: "none", padding: isMobile ? "10px 12px" : "12px 14px",
              fontSize: isMobile ? 15 : 14, fontFamily: "inherit", color: "#2c3e50",
              lineHeight: 1.5, maxHeight: isMobile ? 120 : 160, background: "transparent" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 10px 8px", alignItems: "center" }}>
            {!isMobile && (
              <span style={{ fontSize: 12, color: "#9aa5b4", marginRight: "auto" }}>
                Invio per inviare · Shift+Invio per andare a capo
              </span>
            )}
            <button onClick={handleSend} disabled={!hasText || loading || !productId}
              style={{ background: hasText && !loading && productId ? "#003781" : "#c8d4e8",
                border: "none", borderRadius: 6, width: isMobile ? 40 : 34, height: isMobile ? 40 : 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: hasText && !loading && productId ? "pointer" : "not-allowed" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => { const c = messages.map(m => `[${m.role === "user" ? "Tu" : "UltrAI"} – ${m.timestamp.toLocaleTimeString("it-IT")}]\n${m.content}`).join("\n\n---\n\n"); handleExport(c); }}
            disabled={messages.length === 0}
            style={{ border: "1px solid #003781", borderRadius: 6, padding: "6px 12px",
              fontSize: isMobile ? 12 : 12.5, color: "#003781", background: "transparent",
              cursor: messages.length === 0 ? "not-allowed" : "pointer",
              opacity: messages.length === 0 ? 0.4 : 1 }}>
            ⬇️ {isMobile ? "Esporta" : "Esporta chat"}
          </button>
          <button onClick={onNewConversation}
            style={{ border: "1px solid #003781", borderRadius: 6, padding: "6px 12px",
              fontSize: isMobile ? 12 : 12.5, color: "#003781", background: "transparent", cursor: "pointer" }}>
            + {isMobile ? "Nuova" : "Nuova chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
