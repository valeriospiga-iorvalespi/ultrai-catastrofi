// components/Sidebar.tsx
"use client";

import React, { useState } from "react";

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sourceIds?: string[];
  timestamp: string; // ISO string per serializzazione
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
}

const HISTORY_KEY = "ultrai_cni_history";
const MESSAGES_PREFIX = "ultrai_cni_msgs_";

export function loadHistory(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveHistory(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
}

// ✅ NUOVO: salva i messaggi di una conversazione
export function saveMessages(conversationId: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `${MESSAGES_PREFIX}${conversationId}`,
    JSON.stringify(messages)
  );
}

// ✅ NUOVO: carica i messaggi di una conversazione
export function loadMessages(conversationId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem(`${MESSAGES_PREFIX}${conversationId}`) || "[]"
    );
  } catch {
    return [];
  }
}

// ✅ NUOVO: elimina i messaggi di una conversazione
export function deleteMessages(conversationId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${MESSAGES_PREFIX}${conversationId}`);
}

export default function Sidebar({ conversations, activeId, onNew, onSelect }: SidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const groups: { label: string; items: Conversation[] }[] = [];

  const todayItems = filtered.filter((c) => new Date(c.updatedAt).toDateString() === today);
  const yesterdayItems = filtered.filter(
    (c) => new Date(c.updatedAt).toDateString() === yesterday
  );
  const olderItems = filtered.filter(
    (c) =>
      new Date(c.updatedAt).toDateString() !== today &&
      new Date(c.updatedAt).toDateString() !== yesterday
  );

  if (todayItems.length) groups.push({ label: "Oggi", items: todayItems });
  if (yesterdayItems.length) groups.push({ label: "Ieri", items: yesterdayItems });
  if (olderItems.length) groups.push({ label: "Precedenti", items: olderItems });

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        height: "100%",
        background: "#f9fafb",
        borderRight: "1px solid #e0e0e0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px 8px" }}>
        <button
          onClick={onNew}
          style={{
            width: "100%",
            background: "#003781",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "9px 14px",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0050b3")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#003781")}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          Nuova chat
        </button>
      </div>

      <div style={{ padding: "4px 14px 10px" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Cerca chat…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              padding: "7px 10px 7px 32px",
              fontSize: 13,
              outline: "none",
              background: "#fff",
              color: "#2c3e50",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9aa5b4",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {groups.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "#9aa5b4",
              fontSize: 13,
            }}
          >
            Nessuna conversazione.
            <br />
            Inizia con una nuova chat.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#9aa5b4",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "6px 6px 4px",
                }}
              >
                {group.label}
              </div>
              {group.items.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  title={conv.title}
                  style={{
                    width: "100%",
                    background: activeId === conv.id ? "#f0f0f0" : "transparent",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 10px",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: activeId === conv.id ? 500 : 400,
                    color: "#2c3e50",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (activeId !== conv.id)
                      (e.currentTarget as HTMLButtonElement).style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    if (activeId !== conv.id)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span style={{ marginRight: 6, opacity: 0.5 }}>💬</span>
                  {conv.title}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #e0e0e0",
          padding: "10px 14px",
          display: "flex",
          gap: 14,
          background: "#f9fafb",
        }}
      >
        <button
          style={{
            background: "none",
            border: "none",
            fontSize: 12.5,
            color: "#5a6a85",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#003781")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#5a6a85")}
        >
          ❓ Aiuto
        </button>
        <button
          style={{
            background: "none",
            border: "none",
            fontSize: 12.5,
            color: "#5a6a85",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#003781")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#5a6a85")}
        >
          🆕 Novità
        </button>
      </div>
    </aside>
  );
}
