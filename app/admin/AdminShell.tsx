// app/admin/AdminShell.tsx — responsive
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Chunk {
  id: string; chunk_id: string; product_id: string;
  heading: string; section: string; article: string;
  tokens: number; created_at: string; note?: string | null;
}

interface Product {
  id: string; name: string; short_name: string;
  chunk_count: number; last_updated: string;
}

type Tab = "upload" | "chunks" | "products" | "config";

function ChunkCard({ chunk, onDelete, onSave }: {
  chunk: Chunk;
  onDelete: (id: string) => void;
  onSave: (id: string, note: string, heading: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(chunk.note ?? "");
  const [heading, setHeading] = useState(chunk.heading);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try { await onSave(chunk.id, note, heading); setSaveMsg("✓ Salvato"); setEditing(false); setTimeout(() => setSaveMsg(null), 2000); }
    catch { setSaveMsg("✗ Errore"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      border: `1px solid ${editing ? "#003781" : "#e8ecf0"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ background: "#e8f0fb", color: "#003781", borderRadius: 4,
          padding: "2px 7px", fontSize: 11, fontWeight: 600,
          maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={chunk.chunk_id}>{chunk.chunk_id}</span>
        <span style={{ background: "#f0f4fb", color: "#5a6a85", borderRadius: 4, padding: "2px 7px", fontSize: 11 }}>
          {chunk.tokens} token
        </span>
        {chunk.note && (
          <span style={{ background: "#fff3cd", color: "#856404", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>
            📌 {chunk.note}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setEditing((v) => !v)}
            style={{ background: editing ? "#e8f0fb" : "none", border: "1px solid #c5d8f5",
              borderRadius: 4, padding: "4px 10px", fontSize: 12, color: "#003781", cursor: "pointer" }}>
            ✏️
          </button>
          <button onClick={() => onDelete(chunk.id)}
            style={{ background: "none", border: "1px solid #ffbdbd", borderRadius: 4,
              padding: "4px 10px", fontSize: 12, color: "#c0392b", cursor: "pointer" }}>
            🗑️
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#003781", marginBottom: 2 }}>{chunk.heading}</div>
      {chunk.article && chunk.article !== chunk.heading && (
        <div style={{ fontSize: 11.5, color: "#888" }}>{chunk.article}</div>
      )}
      {editing && (
        <div style={{ marginTop: 12, background: "#f8fafd", borderRadius: 8, padding: "14px 16px", border: "1px solid #e8f0fb" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003781", marginBottom: 10 }}>✏️ Modifica metadati</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Heading</label>
            <input value={heading} onChange={(e) => setHeading(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d9e0",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none", color: "#2c3e50" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Nota retriever</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. includi sempre"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d9e0",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none", color: "#2c3e50" }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background: saving ? "#c8d4e8" : "#003781", color: "#fff", border: "none",
                borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "…" : "💾 Salva"}
            </button>
            <button onClick={() => { setEditing(false); setNote(chunk.note ?? ""); setHeading(chunk.heading); }}
              style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
                padding: "8px 16px", fontSize: 13, color: "#5a6a85", cursor: "pointer" }}>
              Annulla
            </button>
            {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith("✓") ? "#2e7d32" : "#c0392b" }}>{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminShell() {
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [uploadMode, setUploadMode] = useState<"replace" | "append">("replace");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [filterProduct, setFilterProduct] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductShort, setNewProductShort] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [config, setConfig] = useState({ persona: "", domain: "", guardrails: "", language: "" });
  const [configProductId, setConfigProductId] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      const prods: Product[] = data.products ?? [];
      setProducts(prods);
      if (!selectedProduct && prods.length > 0) setSelectedProduct(prods[0].id);
      if (!configProductId && prods.length > 0) setConfigProductId(prods[0].id);
    } catch { setProducts([]); }
  }, [selectedProduct, configProductId]);

  const fetchChunks = useCallback(async (productId?: string) => {
    setChunksLoading(true);
    try {
      const pid = productId ?? filterProduct;
      const url = pid && pid !== "all" ? `/api/admin/chunks?productId=${pid}` : `/api/admin/chunks`;
      const res = await fetch(url);
      const data = await res.json();
      setChunks(data.chunks ?? []);
    } catch { setChunks([]); }
    finally { setChunksLoading(false); }
  }, [filterProduct]);

  const fetchConfig = useCallback(async (productId: string) => {
    if (!productId) return;
    setConfigLoading(true);
    try {
      const res = await fetch(`/api/admin/config?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig({ persona: data.persona ?? "", domain: data.domain ?? "", guardrails: data.guardrails ?? "", language: data.language ?? "" });
      }
    } catch (e) { console.error(e); }
    finally { setConfigLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => {
    if (tab === "chunks") fetchChunks(filterProduct);
    if (tab === "products") fetchProducts();
    if (tab === "config" && configProductId) fetchConfig(configProductId);
  }, [tab]);
  useEffect(() => { if (tab === "chunks") fetchChunks(filterProduct); }, [filterProduct]);
  useEffect(() => { if (tab === "config" && configProductId) fetchConfig(configProductId); }, [configProductId]);

  const handleUpload = async () => {
    if (!file || !selectedProduct) return;
    setUploading(true); setUploadResult(null);
    const form = new FormData();
    form.append("file", file); form.append("productId", selectedProduct); form.append("mode", uploadMode);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        const msg = uploadMode === "replace"
          ? `${data.count} chunk creati.`
          : `${data.count} chunk inseriti${data.skipped > 0 ? `, ${data.skipped} duplicati saltati` : ""}.`;
        setUploadResult({ ok: true, message: msg });
        setFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
        fetchProducts();
      } else { setUploadResult({ ok: false, message: data.error ?? "Errore." }); }
    } catch { setUploadResult({ ok: false, message: "Errore di rete." }); }
    finally { setUploading(false); }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;
    setCreatingProduct(true); setProductMsg(null);
    try {
      const res = await fetch("/api/admin/products", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName.trim(), short_name: newProductShort.trim() }) });
      const data = await res.json();
      if (res.ok) {
        setProductMsg({ ok: true, text: `"${data.product.name}" creato.` });
        setNewProductName(""); setNewProductShort(""); setShowNewProduct(false); fetchProducts();
      } else { setProductMsg({ ok: false, text: data.error ?? "Errore." }); }
    } catch { setProductMsg({ ok: false, text: "Errore di rete." }); }
    finally { setCreatingProduct(false); }
  };

  const handleRenameProduct = async (id: string, name: string, shortName: string) => {
    const res = await fetch("/api/admin/products", { method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, short_name: shortName }) });
    if (!res.ok) throw new Error("Rinomina fallita");
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, name, short_name: shortName } : p));
  };

  const handleDeleteChunk = async (id: string) => {
    if (!confirm("Eliminare questo chunk?")) return;
    await fetch(`/api/admin/chunks/${id}`, { method: "DELETE" });
    setChunks((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveChunkMeta = async (id: string, note: string, heading: string) => {
    const res = await fetch(`/api/admin/chunks/${id}`, { method: "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, heading }) });
    if (!res.ok) throw new Error("Salvataggio fallito");
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, note: note || null, heading } : c));
  };

  const filteredChunks = chunks.filter((c) => {
    const s = search.toLowerCase();
    return !s || c.heading.toLowerCase().includes(s) || c.section.toLowerCase().includes(s) ||
      c.article.toLowerCase().includes(s) || (c.note ?? "").toLowerCase().includes(s) || c.chunk_id.toLowerCase().includes(s);
  });

  const TAB_LABELS: Record<Tab, string> = {
    upload: isMobile ? "⬆️ Upload" : "⬆️ Upload documento",
    chunks: isMobile ? "📄 Chunk" : "📄 Chunk indicizzati",
    products: isMobile ? "📦 Prodotti" : "📦 Prodotti",
    config: isMobile ? "⚙️ Config" : "⚙️ Configurazione",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#f5f7fa", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e0e0e0",
        padding: isMobile ? "0 14px" : "0 24px", height: 56,
        display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e30613", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, color: "#003781", flex: 1 }}>
          {isMobile ? "Admin Panel" : "UltrAI – Admin Panel"}
        </span>
        <span style={{ background: "#fef3cd", color: "#856404", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>ADMIN</span>
        <a href="/chat" style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
          padding: isMobile ? "6px 10px" : "6px 14px", fontSize: isMobile ? 12 : 13,
          cursor: "pointer", color: "#5a6a85", textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>
          {isMobile ? "← Chat" : "← Torna alla chat"}
        </a>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "20px 14px" : "32px 24px" }}>
        {!isMobile && (
          <>
            <h1 style={{ color: "#003781", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Gestione Knowledge Base</h1>
            <p style={{ color: "#5a6a85", fontSize: 14, marginBottom: 28 }}>
              Carica documenti, visualizza i chunk indicizzati e gestisci i prodotti.
            </p>
          </>
        )}

        {/* Tabs — scroll orizzontale su mobile */}
        <div style={{ display: "flex", borderBottom: "2px solid #e0e0e0", marginBottom: 24,
          overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
          {(["upload", "chunks", "products", "config"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #003781" : "2px solid transparent",
                marginBottom: -2, padding: isMobile ? "10px 16px" : "10px 20px",
                fontSize: isMobile ? 13 : 14, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#003781" : "#5a6a85", cursor: "pointer",
                whiteSpace: "nowrap", flexShrink: 0 }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── UPLOAD ── */}
        {tab === "upload" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 20 : 32,
            maxWidth: 640, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2c3e50", marginBottom: 20 }}>Carica documento</h2>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Prodotto</label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #d1d9e0", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none", background: "#fff" }}>
                {products.length === 0 && <option value="">— Nessun prodotto —</option>}
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 10 }}>Modalità</label>
              <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
                {([
                  { value: "append", label: "➕ Aggiungi", desc: "Aggiunge senza eliminare i chunk esistenti." },
                  { value: "replace", label: "🔄 Sostituisci", desc: "Elimina tutto e ricarica dal nuovo file." },
                ] as const).map((opt) => (
                  <div key={opt.value} onClick={() => setUploadMode(opt.value)}
                    style={{ flex: 1, border: `2px solid ${uploadMode === opt.value ? "#003781" : "#e0e0e0"}`,
                      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                      background: uploadMode === opt.value ? "#f0f6ff" : "#fff" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: uploadMode === opt.value ? "#003781" : "#2c3e50", marginBottom: 3 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>File (.docx, .md, .pdf)</label>
              <div style={{ border: "2px dashed #b8c9e8", borderRadius: 8, padding: "24px 20px",
                textAlign: "center", cursor: "pointer", background: file ? "#f0f8ff" : "#fafcff" }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.(docx|md|pdf)$/i.test(f.name)) setFile(f); }}>
                {file ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                    <div style={{ fontWeight: 600, color: "#003781", fontSize: 14 }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB</div>
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      style={{ marginTop: 8, background: "none", border: "1px solid #ffbdbd", borderRadius: 4,
                        padding: "3px 10px", fontSize: 12, color: "#c0392b", cursor: "pointer" }}>
                      ✕ Rimuovi
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14, color: "#5a6a85" }}>
                      {isMobile ? "Tocca per scegliere il file" : <>Trascina qui o <span style={{ color: "#003781", fontWeight: 600 }}>clicca per sfogliare</span></>}
                    </div>
                    <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>.docx · .md · .pdf</div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".docx,.md,.pdf" style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            {uploadResult && (
              <div style={{ background: uploadResult.ok ? "#e8f5e9" : "#fff0f0",
                border: `1px solid ${uploadResult.ok ? "#81c784" : "#ef9a9a"}`,
                borderRadius: 6, padding: "10px 14px", fontSize: 13,
                color: uploadResult.ok ? "#2e7d32" : "#c0392b", marginBottom: 16 }}>
                {uploadResult.ok ? "✅ " : "❌ "}{uploadResult.message}
              </div>
            )}

            <button onClick={handleUpload} disabled={!file || !selectedProduct || uploading}
              style={{ width: "100%", background: !file || !selectedProduct || uploading ? "#c8d4e8" : "#003781",
                color: "#fff", border: "none", borderRadius: 8,
                padding: isMobile ? "14px" : "12px", fontSize: 15, fontWeight: 600,
                cursor: !file || !selectedProduct || uploading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {uploading ? (
                <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  animation: "spin 0.8s linear infinite" }} />Caricamento…</>
              ) : `⬆️ ${uploadMode === "append" ? "Aggiungi" : "Sostituisci"}`}
            </button>
          </div>
        )}

        {/* ── CHUNKS ── */}
        {tab === "chunks" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}
                style={{ border: "1.5px solid #d1d9e0", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#2c3e50", background: "#fff", outline: "none",
                  flex: isMobile ? "1" : "0 0 auto" }}>
                <option value="all">Tutti</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" placeholder="Cerca…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: "1.5px solid #d1d9e0", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#2c3e50", background: "#fff", outline: "none",
                  flex: 1, minWidth: isMobile ? 0 : 200 }} />
              {!isMobile && (
                <span style={{ fontSize: 13, color: "#9aa5b4", alignSelf: "center" }}>{filteredChunks.length} chunk</span>
              )}
              <button onClick={() => fetchChunks(filterProduct)}
                style={{ background: "none", border: "1px solid #d1d9e0", borderRadius: 6,
                  padding: "8px 12px", fontSize: 13, cursor: "pointer", color: "#5a6a85" }}>
                🔄
              </button>
            </div>
            {isMobile && (
              <div style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 12 }}>{filteredChunks.length} chunk trovati</div>
            )}
            {chunksLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9aa5b4" }}>Caricamento…</div>
            ) : filteredChunks.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", color: "#9aa5b4" }}>
                Nessun chunk trovato.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredChunks.map((chunk) => (
                  <ChunkCard key={chunk.id} chunk={chunk} onDelete={handleDeleteChunk} onSave={handleSaveChunkMeta} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {tab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: "#5a6a85" }}>{products.length} prodotti</div>
              <button onClick={() => setShowNewProduct((v) => !v)}
                style={{ background: "#003781", color: "#fff", border: "none", borderRadius: 8,
                  padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nuovo
              </button>
            </div>

            {showNewProduct && (
              <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24,
                marginBottom: 20, border: "2px solid #003781" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#003781", marginBottom: 14 }}>+ Nuovo prodotto</h3>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexDirection: isMobile ? "column" : "row" }}>
                  <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Nome completo *"
                    style={{ flex: 2, border: "1.5px solid #d1d9e0", borderRadius: 8,
                      padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none" }} />
                  <input value={newProductShort} onChange={(e) => setNewProductShort(e.target.value)}
                    placeholder="Nome breve"
                    style={{ flex: 1, border: "1.5px solid #d1d9e0", borderRadius: 8,
                      padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none" }} />
                </div>
                {productMsg && (
                  <div style={{ fontSize: 13, color: productMsg.ok ? "#2e7d32" : "#c0392b", marginBottom: 10 }}>
                    {productMsg.ok ? "✓ " : "✗ "}{productMsg.text}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreateProduct} disabled={creatingProduct || !newProductName.trim()}
                    style={{ background: !newProductName.trim() ? "#c8d4e8" : "#003781", color: "#fff",
                      border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    {creatingProduct ? "…" : "Crea"}
                  </button>
                  <button onClick={() => { setShowNewProduct(false); setNewProductName(""); setNewProductShort(""); }}
                    style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 8,
                      padding: "10px 18px", fontSize: 14, color: "#5a6a85", cursor: "pointer" }}>
                    Annulla
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {products.map((product) => (
                <div key={product.id} style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e8ecf0" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#e8f0fb",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2c3e50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</div>
                      {product.short_name && <div style={{ fontSize: 12, color: "#5a6a85" }}>{product.short_name}</div>}
                      <div style={{ fontSize: 10, color: "#9aa5b4", fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{product.id}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <div style={{ background: "#f5f7fa", borderRadius: 8, padding: "8px 12px", flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#003781" }}>{product.chunk_count}</div>
                      <div style={{ fontSize: 11, color: "#9aa5b4" }}>chunk</div>
                    </div>
                    <div style={{ background: "#f5f7fa", borderRadius: 8, padding: "8px 12px", flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6a85" }}>
                        {product.last_updated !== "-" ? new Date(product.last_updated).toLocaleDateString("it-IT") : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9aa5b4" }}>upload</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <RenameProductInline product={product} onRename={handleRenameProduct} />
                    <button onClick={() => { setSelectedProduct(product.id); setTab("upload"); }}
                      style={{ flex: 1, background: "#003781", border: "none", borderRadius: 6,
                        padding: "8px 0", fontSize: 12, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                      ⬆️ Carica
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Prodotto</label>
              <select value={configProductId} onChange={(e) => setConfigProductId(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #d1d9e0", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none", background: "#fff", marginBottom: 20 }}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {configLoading ? <div style={{ color: "#888", fontSize: 13 }}>Caricamento...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {[
                  { key: "persona" as const, label: "Persona", hint: "Ruolo e tono.", rows: 4 },
                  { key: "domain" as const, label: "Dominio", hint: "Prodotto e caratteristiche.", rows: 5 },
                  { key: "guardrails" as const, label: "Guardrail aggiuntivi", hint: "Regole extra.", rows: 4 },
                  { key: "language" as const, label: "Lingua e stile", hint: "Registro e formato.", rows: 3 },
                ].map((field) => (
                  <div key={field.key}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#2c3e50", marginBottom: 4 }}>{field.label}</label>
                    <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 6 }}>{field.hint}</p>
                    <textarea value={config[field.key]} onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      rows={field.rows}
                      style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dde3ec",
                        borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
                        color: "#2c3e50", lineHeight: 1.6, resize: "vertical", outline: "none" }} />
                  </div>
                ))}
                {configMsg && (
                  <div style={{ padding: "10px 14px", borderRadius: 6, fontSize: 13,
                    background: configMsg.ok ? "#f0fff4" : "#fff0f0",
                    color: configMsg.ok ? "#1a7a3a" : "#8b1a1a",
                    border: `1px solid ${configMsg.ok ? "#9fe0b0" : "#f5c1c1"}` }}>
                    {configMsg.ok ? "✓ " : "✗ "}{configMsg.text}
                  </div>
                )}
                <button onClick={async () => {
                  setConfigSaving(true); setConfigMsg(null);
                  try {
                    const res = await fetch("/api/admin/config", { method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ productId: configProductId, ...config }) });
                    const data = await res.json();
                    setConfigMsg(res.ok ? { ok: true, text: "Salvato." } : { ok: false, text: data.error ?? "Errore." });
                  } catch { setConfigMsg({ ok: false, text: "Errore di rete." }); }
                  finally { setConfigSaving(false); }
                }} disabled={configSaving}
                  style={{ background: configSaving ? "#c8d4e8" : "#003781", color: "#fff", border: "none",
                    borderRadius: 8, padding: isMobile ? "12px 24px" : "10px 24px", fontSize: 14, fontWeight: 600,
                    cursor: configSaving ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
                  {configSaving ? "Salvataggio..." : "💾 Salva"}
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

// Componente inline rinomina prodotto
function RenameProductInline({ product, onRename }: {
  product: Product;
  onRename: (id: string, name: string, shortName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [shortName, setShortName] = useState(product.short_name ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)}
        style={{ flex: 1, background: "none", border: "1px solid #c5d8f5", borderRadius: 6,
          padding: "8px 0", fontSize: 12, color: "#003781", cursor: "pointer" }}>
        ✏️ Rinomina
      </button>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <input value={name} onChange={(e) => setName(e.target.value)}
        style={{ border: "1.5px solid #003781", borderRadius: 6, padding: "6px 8px",
          fontSize: 12, color: "#2c3e50", outline: "none", width: "100%", boxSizing: "border-box" }} />
      <input value={shortName} onChange={(e) => setShortName(e.target.value)}
        placeholder="Nome breve"
        style={{ border: "1px solid #d1d9e0", borderRadius: 6, padding: "6px 8px",
          fontSize: 12, color: "#2c3e50", outline: "none", width: "100%", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={async () => {
          setSaving(true);
          try { await onRename(product.id, name, shortName); setEditing(false); }
          catch { /* silent */ }
          finally { setSaving(false); }
        }} style={{ flex: 1, background: "#003781", color: "#fff", border: "none",
          borderRadius: 4, padding: "5px 0", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "…" : "Salva"}
        </button>
        <button onClick={() => { setEditing(false); setName(product.name); setShortName(product.short_name ?? ""); }}
          style={{ flex: 1, background: "none", border: "1px solid #e0e0e0", borderRadius: 4,
            padding: "5px 0", fontSize: 11, color: "#5a6a85", cursor: "pointer" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
