// app/admin/AdminShell.tsx — Client Component
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ✅ FIX: campi allineati allo schema reale della tabella "chunks"
interface Chunk {
  id: string;
  chunk_id: string;
  product_id: string;
  heading: string;       // era source_file — non esiste in DB
  section: string;
  article: string;
  tokens: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  chunk_count: number;
  last_updated: string;
}

type Tab = "upload" | "chunks" | "products" | "config";

const PRODUCTS = [
  { id: "a986fcdc-a745-4cc2-848c-165477b1fbf3", name: "Catastrofi naturali Impresa" },
  { id: "ultrai-salute", name: "UltrAI Salute" },
  { id: "casa-patrimonio", name: "Casa e Patrimonio" },
];

export default function AdminShell() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean;
    message: string;
    chunks?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunks state
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [filterProduct, setFilterProduct] = useState("all");
  const [search, setSearch] = useState("");

  // Products state
  const [products, setProducts] = useState<Product[]>([]);

  // Config state
  const [config, setConfig] = useState({
    persona: "",
    domain: "",
    guardrails: "",
    language: "",
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ✅ FIX: fetchChunks ora passa productId se selezionato
  const fetchChunks = useCallback(async (productId?: string) => {
    setChunksLoading(true);
    try {
      const url = productId && productId !== "all"
        ? `/api/admin/chunks?productId=${productId}`
        : `/api/admin/chunks`;
      const res = await fetch(url);
      const data = await res.json();
      setChunks(data.chunks ?? []);
    } catch {
      setChunks([]);
    } finally {
      setChunksLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts([]);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`/api/admin/config?productId=${PRODUCTS[0].id}`);
      if (res.ok) {
        const data = await res.json();
        setConfig({
          persona: data.persona ?? "",
          domain: data.domain ?? "",
          guardrails: data.guardrails ?? "",
          language: data.language ?? "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Load data on tab change
  useEffect(() => {
    if (tab === "chunks") fetchChunks();
    if (tab === "products") fetchProducts();
    if (tab === "config") fetchConfig();
  }, [tab, fetchChunks, fetchProducts, fetchConfig]);

  // ✅ FIX: aggiorna i chunk quando cambia il filtro prodotto
  useEffect(() => {
    if (tab === "chunks") fetchChunks(filterProduct);
  }, [filterProduct, tab, fetchChunks]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: PRODUCTS[0].id, ...config }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigMsg({ ok: true, text: "Configurazione salvata correttamente." });
      } else {
        setConfigMsg({ ok: false, text: data.error ?? "Errore nel salvataggio." });
      }
    } catch {
      setConfigMsg({ ok: false, text: "Errore di rete." });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("productId", selectedProduct);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadResult({
        ok: res.ok,
        message: res.ok
          ? `Caricamento completato con successo!`
          : (data.error ?? "Errore durante il caricamento."),
        chunks: data.count,
      });
      if (res.ok) {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setUploadResult({ ok: false, message: "Errore di rete durante l'upload." });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteChunk = async (id: string) => {
    if (!confirm("Eliminare questo chunk?")) return;
    await fetch(`/api/admin/chunks/${id}`, { method: "DELETE" });
    setChunks((prev) => prev.filter((c) => c.id !== id));
  };

  // ✅ FIX: filtro usa i campi corretti (heading, section, article)
  const filteredChunks = chunks.filter((c) => {
    const matchProduct = filterProduct === "all" || c.product_id === filterProduct;
    const matchSearch =
      !search ||
      c.heading.toLowerCase().includes(search.toLowerCase()) ||
      c.section.toLowerCase().includes(search.toLowerCase()) ||
      c.article.toLowerCase().includes(search.toLowerCase());
    return matchProduct && matchSearch;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fa",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Header Admin */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Image
          src="/allianz-logo.png"
          alt="Allianz"
          width={30}
          height={30}
          style={{ objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span style={{ fontWeight: 700, fontSize: 16, color: "#003781" }}>
          UltrAI – Admin Panel
        </span>
        <span
          style={{
            background: "#fef3cd",
            color: "#856404",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ADMIN
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => router.push("/chat")}
          style={{
            background: "none",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            color: "#5a6a85",
          }}
        >
          ← Torna alla chat
        </button>
      </header>

      {/* ✅ FIX: tutto il contenuto è dentro questo container, inclusa la tab Config */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ color: "#003781", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Gestione Knowledge Base
        </h1>
        <p style={{ color: "#5a6a85", fontSize: 14, marginBottom: 28 }}>
          Carica documenti, visualizza i chunk indicizzati e gestisci i prodotti.
        </p>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "2px solid #e0e0e0",
            marginBottom: 28,
          }}
        >
          {(
            [
              { id: "upload", label: "⬆️ Upload documento" },
              { id: "chunks", label: "📄 Chunk indicizzati" },
              { id: "products", label: "📦 Prodotti" },
              { id: "config", label: "⚙️ Configurazione" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? "2px solid #003781" : "2px solid transparent",
                marginBottom: -2,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? "#003781" : "#5a6a85",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB UPLOAD ── */}
        {tab === "upload" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 32,
              maxWidth: 600,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#2c3e50", marginBottom: 20 }}>
              Carica documento .docx
            </h2>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Prodotto di destinazione
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={{
                  width: "100%",
                  border: "1.5px solid #d1d9e0",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "#2c3e50",
                  outline: "none",
                  background: "#fff",
                }}
              >
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                File documento (.docx)
              </label>
              <div
                style={{
                  border: "2px dashed #b8c9e8",
                  borderRadius: 8,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: file ? "#f0f8ff" : "#fafcff",
                  transition: "all 0.2s",
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.name.endsWith(".docx")) setFile(f);
                }}
              >
                {file ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                    <div style={{ fontWeight: 600, color: "#003781", fontSize: 14 }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14, color: "#5a6a85" }}>
                      Trascina il file qui o <span style={{ color: "#003781", fontWeight: 600 }}>clicca per sfogliare</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>Solo .docx</div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {uploadResult && (
              <div
                style={{
                  background: uploadResult.ok ? "#e8f5e9" : "#fff0f0",
                  border: `1px solid ${uploadResult.ok ? "#81c784" : "#ef9a9a"}`,
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: uploadResult.ok ? "#2e7d32" : "#c0392b",
                  marginBottom: 16,
                }}
              >
                {uploadResult.ok ? "✅ " : "❌ "}
                {uploadResult.message}
                {uploadResult.chunks !== undefined && ` (${uploadResult.chunks} chunk creati)`}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                width: "100%",
                background: !file || uploading ? "#c8d4e8" : "#003781",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px",
                fontSize: 15,
                fontWeight: 600,
                cursor: !file || uploading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {uploading ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Upload in corso…
                </>
              ) : (
                "⬆️ Avvia upload e chunking"
              )}
            </button>
          </div>
        )}

        {/* ── TAB CHUNKS ── */}
        {tab === "chunks" && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                style={{
                  border: "1.5px solid #d1d9e0",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#2c3e50",
                  background: "#fff",
                  outline: "none",
                }}
              >
                <option value="all">Tutti i prodotti</option>
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Cerca in heading / sezione…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "1.5px solid #d1d9e0",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#2c3e50",
                  background: "#fff",
                  outline: "none",
                  minWidth: 220,
                }}
              />
              <span style={{ fontSize: 13, color: "#9aa5b4", alignSelf: "center" }}>
                {filteredChunks.length} chunk trovati
              </span>
              <button
                onClick={() => fetchChunks(filterProduct)}
                style={{
                  background: "none",
                  border: "1px solid #d1d9e0",
                  borderRadius: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#5a6a85",
                  marginLeft: "auto",
                }}
              >
                🔄 Aggiorna
              </button>
            </div>

            {chunksLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9aa5b4" }}>
                Caricamento chunk…
              </div>
            ) : filteredChunks.length === 0 ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 48,
                  textAlign: "center",
                  color: "#9aa5b4",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                Nessun chunk trovato. Carica un documento dalla tab Upload.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    style={{
                      background: "#fff",
                      borderRadius: 10,
                      padding: "14px 18px",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                      border: "1px solid #e8ecf0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      {/* ✅ FIX: usa chunk_id invece di chunk_index */}
                      <span
                        style={{
                          background: "#e8f0fb",
                          color: "#003781",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 11,
                          fontWeight: 600,
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={chunk.chunk_id}
                      >
                        {chunk.chunk_id}
                      </span>
                      {/* ✅ FIX: usa heading invece di source_file */}
                      <span style={{ fontSize: 12, color: "#5a6a85", fontWeight: 500 }}>
                        📄 {chunk.section || "—"}
                      </span>
                      <span
                        style={{
                          background: "#f0f4fb",
                          color: "#5a6a85",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 11,
                        }}
                      >
                        {chunk.tokens} token
                      </span>
                      <span
                        style={{
                          background: "#f5f0fb",
                          color: "#7c3aed",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 11,
                        }}
                      >
                        {PRODUCTS.find((p) => p.id === chunk.product_id)?.name ?? chunk.product_id}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => handleDeleteChunk(chunk.id)}
                        style={{
                          background: "none",
                          border: "1px solid #ffbdbd",
                          borderRadius: 4,
                          padding: "3px 10px",
                          fontSize: 12,
                          color: "#c0392b",
                          cursor: "pointer",
                        }}
                      >
                        🗑️ Elimina
                      </button>
                    </div>
                    {/* ✅ FIX: mostra heading come titolo e article come sottotitolo */}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#003781", marginBottom: 4 }}>
                      {chunk.heading}
                    </div>
                    {chunk.article && chunk.article !== chunk.heading && (
                      <div style={{ fontSize: 11.5, color: "#888", marginBottom: 6 }}>
                        {chunk.article}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB PRODUCTS ── */}
        {tab === "products" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {(products.length > 0 ? products : PRODUCTS.map((p) => ({
                id: p.id,
                name: p.name,
                chunk_count: 0,
                last_updated: "-",
              }))).map((product) => (
                <div
                  key={product.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    border: "1px solid #e8ecf0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "#e8f0fb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      📦
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2c3e50" }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2, fontFamily: "monospace" }}>
                        {product.id}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div
                      style={{
                        background: "#f5f7fa",
                        borderRadius: 8,
                        padding: "8px 12px",
                        flex: 1,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#003781" }}>
                        {product.chunk_count}
                      </div>
                      <div style={{ fontSize: 11, color: "#9aa5b4" }}>chunk</div>
                    </div>
                    <div
                      style={{
                        background: "#f5f7fa",
                        borderRadius: 8,
                        padding: "8px 12px",
                        flex: 1,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6a85" }}>
                        {product.last_updated !== "-"
                          ? new Date(product.last_updated).toLocaleDateString("it-IT")
                          : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9aa5b4" }}>aggiornamento</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ FIX: tab Config ora è DENTRO il container maxWidth */}
        {tab === "config" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#2c3e50", marginBottom: 6 }}>
                Configurazione assistente
              </h3>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                Personalizza il comportamento dell&apos;assistente per il prodotto{" "}
                <strong>Catastrofi naturali Impresa</strong>.
                Lascia vuoto per usare i valori di default.
              </p>
            </div>

            {configLoading ? (
              <div style={{ color: "#888", fontSize: 13 }}>Caricamento...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {[
                  {
                    key: "persona" as const,
                    label: "Persona",
                    placeholder: "Es. Sei UltrAI Catastrofi naturali Impresa, assistente per agenti assicurativi Allianz...",
                    hint: "Definisce il ruolo e il tono dell'assistente.",
                    rows: 4,
                  },
                  {
                    key: "domain" as const,
                    label: "Dominio / Contesto prodotto",
                    placeholder: "Es. Il prodotto copre danni causati da sisma, alluvione, frana...",
                    hint: "Descrive il prodotto e le sue caratteristiche principali.",
                    rows: 5,
                  },
                  {
                    key: "guardrails" as const,
                    label: "Guardrail aggiuntivi",
                    placeholder: "Es. Non rispondere a domande su altri prodotti Allianz...",
                    hint: "Regole aggiuntive di comportamento (si sommano a quelle di default).",
                    rows: 4,
                  },
                  {
                    key: "language" as const,
                    label: "Lingua e stile",
                    placeholder: "Es. Usa italiano formale. Risposte strutturate con elenchi puntati...",
                    hint: "Lingua, registro e formato delle risposte.",
                    rows: 3,
                  },
                ].map((field) => (
                  <div key={field.key}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#2c3e50", marginBottom: 4 }}>
                      {field.label}
                    </label>
                    <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 6 }}>{field.hint}</p>
                    <textarea
                      value={config[field.key]}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #dde3ec",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "#2c3e50",
                        lineHeight: 1.6,
                        resize: "vertical",
                        outline: "none",
                      }}
                    />
                  </div>
                ))}

                {configMsg && (
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    background: configMsg.ok ? "#f0fff4" : "#fff0f0",
                    color: configMsg.ok ? "#1a7a3a" : "#8b1a1a",
                    border: `1px solid ${configMsg.ok ? "#9fe0b0" : "#f5c1c1"}`,
                  }}>
                    {configMsg.ok ? "✓ " : "✗ "}{configMsg.text}
                  </div>
                )}

                <button
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  style={{
                    background: configSaving ? "#c8d4e8" : "#003781",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: configSaving ? "not-allowed" : "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  {configSaving ? "Salvataggio..." : "💾 Salva configurazione"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
