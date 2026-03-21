// components/ChatArea.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import WelcomeBox from "./WelcomeBox";

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
}


// Renderizza markdown semplice + citazioni {{chunk_id}} come badge gialli
function CitationBadge({ chunkId, onClick }: { chunkId: string; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      title={`Apri fonte: ${chunkId}`}
      style={{
        display: "inline-block", background: "#fff3cd", border: "1px solid #ffc107",
        borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600,
        color: "#856404", cursor: "pointer", marginLeft: 2, marginRight: 2,
        verticalAlign: "middle", transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe69c")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff3cd")}
    >
      [{chunkId.split("-").slice(-2).join("-")}]
    </span>
  );
}

function renderInline(text: string, onCitationClick: (id: string) => void, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\{\{[^}]+\}\}|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const cite = part.match(/^\{\{([^}]+)\}\}$/);
    if (cite) return <CitationBadge key={`${keyPrefix}-c${i}`} chunkId={cite[1].trim()} onClick={() => onCitationClick(cite[1].trim())} />;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={`${keyPrefix}-b${i}`}>{bold[1]}</strong>;
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>;
  });
}

function renderContent(text: string, onCitationClick: (id: string) => void): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let keyIdx = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${keyIdx++}`} style={{ margin: "6px 0 6px 18px", padding: 0 }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const k = `line-${i}`;
    // H2: ## testo
    if (/^##\s+/.test(line)) {
      flushList();
      const content = line.replace(/^##\s+/, "");
      nodes.push(
        <div key={k} style={{ fontWeight: 700, fontSize: 14.5, color: "#003781", margin: "12px 0 4px" }}>
          {renderInline(content, onCitationClick, k)}
        </div>
      );
      return;
    }
    // H3: ### testo  
    if (/^###\s+/.test(line)) {
      flushList();
      const content = line.replace(/^###\s+/, "");
      nodes.push(
        <div key={k} style={{ fontWeight: 600, fontSize: 13.5, color: "#2c3e50", margin: "8px 0 2px" }}>
          {renderInline(content, onCitationClick, k)}
        </div>
      );
      return;
    }
    // Lista: - testo o • testo
    if (/^[-•]\s+/.test(line)) {
      const content = line.replace(/^[-•]\s+/, "");
      listItems.push(
        <li key={k} style={{ marginBottom: 3, lineHeight: 1.55 }}>
          {renderInline(content, onCitationClick, k)}
        </li>
      );
      return;
    }
    // Riga vuota
    if (!line.trim()) {
      flushList();
      nodes.push(<div key={k} style={{ height: 6 }} />);
      return;
    }
    // Testo normale
    flushList();
    nodes.push(
      <div key={k} style={{ lineHeight: 1.6, marginBottom: 2 }}>
        {renderInline(line, onCitationClick, k)}
      </div>
    );
  });

  flushList();
  return <>{nodes}</>;
}

function TypingIndicator() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4, padding:"12px 16px",
      background:"#f5f7fa", border:"1px solid #e4e8ee", borderRadius:10,
      width:"fit-content", maxWidth:80 }}>
      {[0,1,2].map((i) => (
        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#003781",
          display:"inline-block", animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

function SourcesPanel({ chunks, onClose }: { chunks: ChunkDetail[]; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", top:0, right:0, width:420, height:"100vh",
      background:"#fff", borderLeft:"1px solid #e0e0e0", zIndex:200,
      display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.1)" }}>
      <div style={{ padding:"14px 18px", borderBottom:"1px solid #e0e0e0",
        display:"flex", alignItems:"center", justifyContent:"space-between", background:"#f8fafd" }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:"#003781" }}>Fonti utilizzate</div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>
            {chunks.length} {chunks.length === 1 ? "chunk" : "chunk"} dal normativo
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none",
          fontSize:20, cursor:"pointer", color:"#888", padding:"4px 8px", borderRadius:6, lineHeight:1 }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
        {chunks.length === 0 ? (
          <div style={{ padding:"24px 18px", color:"#aaa", fontSize:13, textAlign:"center" }}>
            Nessuna fonte disponibile.
          </div>
        ) : chunks.map((c, i) => (
          <div key={c.chunk_id} style={{ padding:"12px 18px", borderBottom:"1px solid #f0f0f0" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:8 }}>
              <span style={{ background:"#003781", color:"#fff", borderRadius:"50%",
                width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:600, flexShrink:0, marginTop:1 }}>{i+1}</span>
              <div>
                <div style={{ fontWeight:600, fontSize:12.5, color:"#003781", lineHeight:1.4 }}>
                  {c.heading}
                </div>
                {c.section && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{c.section}</div>}
              </div>
            </div>
            <div style={{ fontSize:12.5, color:"#444", lineHeight:1.65, background:"#f8fafd",
              borderRadius:6, padding:"10px 12px", border:"1px solid #e8f0fb",
              whiteSpace:"pre-wrap", maxHeight:200, overflowY:"auto" }}>
              {c.text.replace(c.heading, "").trim()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({ message, onCopy, onExport, onShowSources, onCitationClick }: {
  message: Message;
  onCopy: (t: string) => void;
  onExport: (t: string) => void;
  onShowSources: (ids: string[]) => void;
  onCitationClick: (chunkId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | "up" | "down">(null);
  const handleCopy = () => { onCopy(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const timeStr = message.timestamp.toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" });
  const hasSources = message.sourceIds && message.sourceIds.length > 0;

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ background:"#f5f7fa", border:"1px solid #e4e8ee", borderRadius:10,
        padding:"14px 18px", maxWidth:"85%", fontSize:14, lineHeight:1.6, color:"#2c3e50",
        boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
          <div style={{ width:20, height:20, borderRadius:4, background:"#003781",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z"/>
            </svg>
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:"#003781" }}>UltrAI</span>
        </div>
        <div style={{ lineHeight:1.6 }}>{renderContent(message.content, onCitationClick)}</div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:6, paddingLeft:4, flexWrap:"wrap" }}>
        {hasSources && (
          <button onClick={() => onShowSources(message.sourceIds!)}
            title="Visualizza le fonti usate per questa risposta"
            style={{ background:"#e8f0fb", border:"1px solid #c5d8f5", borderRadius:4,
              padding:"2px 8px", fontSize:11.5, color:"#003781", fontWeight:600,
              cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
            onMouseEnter={(e) => (e.currentTarget.style.background="#d0e4f7")}
            onMouseLeave={(e) => (e.currentTarget.style.background="#e8f0fb")}>
            📄 {message.sourceIds!.length} {message.sourceIds!.length === 1 ? "fonte" : "fonti"} →
          </button>
        )}
        <span style={{ fontSize:11.5, color:"#9aa5b4" }}>{timeStr}</span>
        <div style={{ flex:1 }} />
        {[
          { label: copied ? "✓ Copiato" : "📋 Copia", action: handleCopy, active: copied },
          { label: "⬇️ Esporta", action: () => onExport(message.content), active: false },
          { label: "👍", action: () => setLiked(liked === "up" ? null : "up"), active: liked === "up" },
          { label: "👎", action: () => setLiked(liked === "down" ? null : "down"), active: liked === "down" },
        ].map((btn) => (
          <button key={btn.label} onClick={btn.action}
            style={{ background: btn.active ? "#e8f0fb" : "none", border:"none",
              borderRadius:4, padding:"2px 7px", fontSize:12,
              color: btn.active ? "#003781" : "#9aa5b4", cursor:"pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color="#003781"; e.currentTarget.style.background="#f0f4fb"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color=btn.active?"#003781":"#9aa5b4"; e.currentTarget.style.background=btn.active?"#e8f0fb":"none"; }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
      <div style={{ background:"#003781", color:"#fff", borderRadius:"18px 18px 4px 18px",
        padding:"10px 16px", maxWidth:"70%", fontSize:14, lineHeight:1.5,
        boxShadow:"0 2px 8px rgba(0,55,129,0.18)" }}>
        {message.content}
      </div>
    </div>
  );
}

export default function ChatArea({ productId, conversationId, onConversationUpdate }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourcesPanel, setSourcesPanel] = useState<ChunkDetail[] | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [inputText]);

  const handleShowSources = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setLoadingSources(true);
    setSourcesPanel([]);
    try {
      const res = await fetch(`/api/chunks?ids=${ids.join(",")}&productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setSourcesPanel(data.chunks || []);
      } else {
        setSourcesPanel(ids.map((id) => ({ chunk_id: id, heading: id, text: "Testo non disponibile." })));
      }
    } catch {
      setSourcesPanel(ids.map((id) => ({ chunk_id: id, heading: id, text: "Errore nel caricamento." })));
    } finally {
      setLoadingSources(false);
    }
  }, [productId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role:"user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    if (messages.length === 0 && onConversationUpdate && conversationId) {
      onConversationUpdate(conversationId, text.slice(0, 50));
    }
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          question: text, productId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role:"assistant",
        content: data.answer || "Mi dispiace, non ho trovato una risposta pertinente.",
        sourceIds: data.sources ?? [],
        timestamp: new Date(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role:"assistant",
        content: "Errore di connessione. Riprova tra qualche istante.", timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, messages, productId, conversationId, onConversationUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (text: string) => navigator.clipboard.writeText(text).catch(console.error);

  const handleExport = (text: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>UltrAI CNI</title>
      <style>body{font-family:sans-serif;max-width:700px;margin:40px auto;line-height:1.7;color:#222}
      h2{color:#003781}pre{white-space:pre-wrap;background:#f5f7fa;padding:16px;border-radius:8px}</style>
      </head><body><h2>UltrAI – Catastrofi naturali Impresa</h2>
      <p><strong>Data:</strong> ${new Date().toLocaleString("it-IT")}</p>
      <pre>${text}</pre>
      <p style="color:#999;font-size:12px">Generato da UltrAI – Allianz Italia</p>
      </body></html>`);
    w.document.close(); w.print();
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#fff" }}>

      {sourcesPanel !== null && (
        <>
          <div onClick={() => setSourcesPanel(null)}
            style={{ position:"fixed", inset:0, zIndex:199, background:"rgba(0,0,0,0.15)" }} />
          {loadingSources ? (
            <div style={{ position:"fixed", top:0, right:0, width:420, height:"100vh",
              background:"#fff", borderLeft:"1px solid #e0e0e0", zIndex:200,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#888", fontSize:14 }}>Caricamento fonti…</span>
            </div>
          ) : (
            <SourcesPanel chunks={sourcesPanel} onClose={() => setSourcesPanel(null)} />
          )}
        </>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
        {messages.length === 0 && <WelcomeBox onSelectQuestion={setInputText} />}
        {messages.map((msg) =>
          msg.role === "user" ? <UserBubble key={msg.id} message={msg} /> : (
            <AssistantBubble key={msg.id} message={msg}
              onCopy={handleCopy} onExport={handleExport} onShowSources={handleShowSources}
              onCitationClick={(chunkId) => handleShowSources([chunkId])} />
          )
        )}
        {loading && <div style={{ marginBottom:12 }}><TypingIndicator /></div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop:"1px solid #e0e0e0", padding:"12px 24px 14px", background:"#fff" }}>
        <div style={{ border:"1px solid #c8d4e8", borderRadius:10, overflow:"hidden", transition:"border-color 0.2s" }}
          onFocusCapture={(e) => (e.currentTarget.style.borderColor = "#003781")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "#c8d4e8")}>
          <textarea id="chat-input" ref={textareaRef} value={inputText}
            onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Fai una domanda sulla polizza Catastrofi naturali Impresa…"
            rows={1}
            style={{ width:"100%", boxSizing:"border-box", border:"none", outline:"none",
              resize:"none", padding:"12px 14px", fontSize:14, fontFamily:"inherit",
              color:"#2c3e50", lineHeight:1.5, maxHeight:160, background:"transparent" }} />
          <div style={{ display:"flex", justifyContent:"flex-end", padding:"6px 10px 8px", gap:6 }}>
            <span style={{ fontSize:12, color:"#9aa5b4", alignSelf:"center", marginRight:"auto" }}>
              Invio per inviare · Shift+Invio per andare a capo
            </span>
            <button onClick={handleSend} disabled={!hasText || loading} title="Invia"
              style={{ background: hasText && !loading ? "#003781" : "#c8d4e8", border:"none",
                borderRadius:6, width:34, height:34, display:"flex", alignItems:"center",
                justifyContent:"center", cursor: hasText && !loading ? "pointer" : "not-allowed",
                transition:"background 0.2s" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
              </svg>
            </button>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:10 }}>
          {[
            { label:"⬇️ Esporta chat", action: () => { const c = messages.map((m) => `[${m.role === "user" ? "Tu" : "UltrAI"} – ${m.timestamp.toLocaleTimeString("it-IT")}]\n${m.content}`).join("\n\n---\n\n"); handleExport(c); }, disabled: messages.length === 0 },
            { label:"+ Nuova chat", action: () => { setMessages([]); setInputText(""); }, disabled: false },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
              style={{ border:"1px solid #003781", borderRadius:6, padding:"6px 14px",
                fontSize:12.5, color:"#003781", background:"transparent",
                cursor: btn.disabled ? "not-allowed" : "pointer", opacity: btn.disabled ? 0.4 : 1,
                transition:"background 0.15s", display:"flex", alignItems:"center", gap:5 }}
              onMouseEnter={(e) => { if (!btn.disabled) e.currentTarget.style.background="#e8f0fb"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
