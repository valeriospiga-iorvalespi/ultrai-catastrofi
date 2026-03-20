// components/ChatArea.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import WelcomeBox from "./WelcomeBox";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: number;
  timestamp: Date;
}

interface ChatAreaProps {
  productId: string;
  conversationId?: string;
  onConversationUpdate?: (id: string, title: string) => void;
}

function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "12px 16px",
        background: "#f5f7fa",
        border: "1px solid #e4e8ee",
        borderRadius: 10,
        width: "fit-content",
        maxWidth: 80,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#003781",
            display: "inline-block",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div
        style={{
          background: "#003781",
          color: "#fff",
          borderRadius: "18px 18px 4px 18px",
          padding: "10px 16px",
          maxWidth: "70%",
          fontSize: 14,
          lineHeight: 1.5,
          boxShadow: "0 2px 8px rgba(0,55,129,0.18)",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onCopy,
  onExport,
}: {
  message: Message;
  onCopy: (text: string) => void;
  onExport: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | "up" | "down">(null);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeStr = message.timestamp.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Bubble */}
      <div
        style={{
          background: "#f5f7fa",
          border: "1px solid #e4e8ee",
          borderRadius: 10,
          padding: "14px 18px",
          maxWidth: "85%",
          fontSize: 14,
          lineHeight: 1.6,
          color: "#2c3e50",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header assistente */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "#003781",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z" />
            </svg>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#003781" }}>UltrAI</span>
        </div>

        {/* Testo risposta */}
        <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
      </div>

      {/* Footer messaggio */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 6,
          paddingLeft: 4,
        }}
      >
        {/* N fonti */}
        {message.sources !== undefined && (
          <span
            style={{
              fontSize: 11.5,
              color: "#003781",
              background: "#e8f0fb",
              borderRadius: 4,
              padding: "2px 7px",
              fontWeight: 500,
            }}
          >
            📄 {message.sources} {message.sources === 1 ? "fonte" : "fonti"}
          </span>
        )}
        {/* Orario */}
        <span style={{ fontSize: 11.5, color: "#9aa5b4" }}>{timeStr}</span>

        {/* Separatore */}
        <div style={{ flex: 1 }} />

        {/* Azioni */}
        <ActionButton
          onClick={handleCopy}
          title="Copia risposta"
          active={copied}
          label={copied ? "✓ Copiato" : "📋 Copia"}
        />
        <ActionButton
          onClick={() => onExport(message.content)}
          title="Esporta risposta"
          label="⬇️ Esporta"
        />
        <ActionButton
          onClick={() => setLiked(liked === "up" ? null : "up")}
          title="Utile"
          active={liked === "up"}
          label="👍"
        />
        <ActionButton
          onClick={() => setLiked(liked === "down" ? null : "down")}
          title="Non utile"
          active={liked === "down"}
          label="👎"
        />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  label,
  active,
}: {
  onClick: () => void;
  title: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? "#e8f0fb" : "none",
        border: "none",
        borderRadius: 4,
        padding: "2px 7px",
        fontSize: 12,
        color: active ? "#003781" : "#9aa5b4",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#003781";
        (e.currentTarget as HTMLButtonElement).style.background = "#f0f4fb";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = active ? "#003781" : "#9aa5b4";
        (e.currentTarget as HTMLButtonElement).style.background = active ? "#e8f0fb" : "none";
      }}
    >
      {label}
    </button>
  );
}

export default function ChatArea({
  productId,
  conversationId,
  onConversationUpdate,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [inputText]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    // Aggiorna titolo conversazione con il primo messaggio
    if (messages.length === 0 && onConversationUpdate && conversationId) {
      onConversationUpdate(conversationId, text.slice(0, 50));
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          productId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "Mi dispiace, non ho trovato una risposta pertinente.",
        sources: data.sourcesCount ?? undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Errore di connessione. Riprova tra qualche istante.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, messages, productId, conversationId, onConversationUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  const handleExport = (text: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>UltrAI CNI – Risposta</title>
      <style>body{font-family:sans-serif;max-width:700px;margin:40px auto;line-height:1.7;color:#222}
      h2{color:#003781}pre{white-space:pre-wrap;background:#f5f7fa;padding:16px;border-radius:8px}</style>
      </head><body>
      <h2>UltrAI – Catastrofi naturali Impresa</h2>
      <p><strong>Data:</strong> ${new Date().toLocaleString("it-IT")}</p>
      <pre>${text}</pre>
      <p style="color:#999;font-size:12px">Generato da UltrAI – Allianz Italia</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const handleExportChat = () => {
    const content = messages
      .map((m) => `[${m.role === "user" ? "Tu" : "UltrAI"} – ${m.timestamp.toLocaleTimeString("it-IT")}]\n${m.content}`)
      .join("\n\n---\n\n");
    handleExport(content);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputText("");
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {/* Messaggi */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 32px",
        }}
      >
        {messages.length === 0 && <WelcomeBox onSelectQuestion={setInputText} />}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserBubble key={msg.id} message={msg} />
          ) : (
            <AssistantBubble
              key={msg.id}
              message={msg}
              onCopy={handleCopy}
              onExport={handleExport}
            />
          )
        )}

        {loading && (
          <div style={{ marginBottom: 12 }}>
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: "1px solid #e0e0e0",
          padding: "12px 24px 14px",
          background: "#fff",
        }}
      >
        <div
          style={{
            border: "1px solid #c8d4e8",
            borderRadius: 10,
            overflow: "hidden",
            transition: "border-color 0.2s",
          }}
          onFocusCapture={(e) =>
            (e.currentTarget.style.borderColor = "#003781")
          }
          onBlurCapture={(e) =>
            (e.currentTarget.style.borderColor = "#c8d4e8")
          }
        >
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Fai una domanda sulla polizza Catastrofi naturali Impresa…"
            rows={1}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              outline: "none",
              resize: "none",
              padding: "12px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              color: "#2c3e50",
              lineHeight: 1.5,
              maxHeight: 160,
              background: "transparent",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "6px 10px 8px",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "#9aa5b4", alignSelf: "center", marginRight: "auto" }}>
              Invio per inviare · Shift+Invio per andare a capo
            </span>
            <button
              onClick={handleSend}
              disabled={!hasText || loading}
              title="Invia"
              style={{
                background: hasText && !loading ? "#003781" : "#c8d4e8",
                border: "none",
                borderRadius: 6,
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: hasText && !loading ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Azioni sotto input */}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={handleExportChat}
            disabled={messages.length === 0}
            style={{
              border: "1px solid #003781",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12.5,
              color: "#003781",
              background: "transparent",
              cursor: messages.length > 0 ? "pointer" : "not-allowed",
              opacity: messages.length > 0 ? 1 : 0.4,
              transition: "background 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onMouseEnter={(e) => {
              if (messages.length > 0)
                (e.currentTarget as HTMLButtonElement).style.background = "#e8f0fb";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            ⬇️ Esporta chat
          </button>
          <button
            onClick={handleNewChat}
            style={{
              border: "1px solid #003781",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12.5,
              color: "#003781",
              background: "transparent",
              cursor: "pointer",
              transition: "background 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#e8f0fb")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
            }
          >
            + Nuova chat
          </button>
        </div>
      </div>
    </div>
  );
}
