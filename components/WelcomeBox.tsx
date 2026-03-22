// components/WelcomeBox.tsx
"use client";

import React from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface WelcomeBoxProps {
  onSelectQuestion?: (q: string) => void;
}

const FONTI = [
  "Condizioni di Assicurazione Catastrofi naturali Impresa (Ed. 01/2024)",
  "Allegato Tecnico – Definizione eventi catastrofali",
  "Circolare IVASS n. 45/2020 – Polizze multirischio imprese",
  "FAQ Prodotto – Allianz Italia (aggiornamento Q1 2025)",
];

const DOMANDE = [
  "Cosa copre la garanzia alluvione?",
  "Qual è la franchigia per terremoto?",
  "Come si denuncia un sinistro?",
  "Sono escluse le inondazioni costiere?",
];

export default function WelcomeBox({ onSelectQuestion }: WelcomeBoxProps) {
  const { isMobile } = useBreakpoint();

  return (
    <div style={{
      background: "#e8f0fb",
      borderRadius: 10,
      padding: isMobile ? "14px 16px" : "18px 22px",
      marginBottom: 24,
      maxWidth: 720,
    }}>
      {/* Intestazione */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#003781",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z"
              fill="white" opacity="0.9" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 15, color: "#003781" }}>
            UltrAI — Catastrofi naturali Impresa
          </div>
          <div style={{ fontSize: 12, color: "#5a6a85" }}>Assistente AI per consulenza sul prodotto</div>
        </div>
      </div>

      {/* Descrizione */}
      <p style={{ fontSize: isMobile ? 13 : 13.5, color: "#2c3e50", lineHeight: 1.55, margin: "0 0 12px 0" }}>
        Posso aiutarti a rispondere a domande sulla polizza{" "}
        <strong>Catastrofi naturali Impresa</strong> di Allianz: garanzie, massimali, franchigie,
        procedure di sinistro ed esclusioni.
      </p>

      {/* Avviso */}
      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6,
        padding: "7px 12px", fontSize: 12, color: "#856404", marginBottom: 12,
        display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <span>Le risposte hanno scopo informativo. In caso di sinistro riferirsi sempre alle Condizioni di Assicurazione in vigore.</span>
      </div>

      {/* Fonti — nascoste su mobile per risparmiare spazio */}
      {!isMobile && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6a85", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Fonti indicizzate ({FONTI.length})
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {FONTI.map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: "#2c3e50", marginBottom: 3 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Domande suggerite */}
      <div style={{ marginTop: isMobile ? 8 : 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {(isMobile ? DOMANDE.slice(0, 2) : DOMANDE).map((q) => (
          <button key={q} onClick={() => onSelectQuestion?.(q)}
            style={{ background: "#fff", border: "1px solid #b8c9e8", borderRadius: 20,
              padding: isMobile ? "6px 14px" : "5px 12px",
              fontSize: isMobile ? 13 : 12.5, color: "#003781", cursor: "pointer" }}
            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "#d8e6f8")}
            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "#fff")}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
