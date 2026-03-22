// app/admin/AdminShell.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface Chunk {
  id: string;
  chunk_id: string;
  product_id: string;
  heading: string;
  section: string;
  article: string;
  tokens: number;
  created_at: string;
  note?: string | null;
}

interface Product {
  id: string;
  name: string;
  short_name: string;
  chunk_count: number;
  last_updated: string;
}

type Tab = "upload" | "chunks" | "products" | "config";

// ─── ChunkCard ───────────────────────────────────────────────────────────────

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
    try {
      await onSave(chunk.id, note, heading);
      setSaveMsg("✓ Salvato"); setEditing(false);
      setTimeout(() => setSaveMsg(null), 2000);
    } catch { setSaveMsg("✗ Errore"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "14px 18px",
      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      border: `1px solid ${editing ? "#003781" : "#e8ecf0"}`, transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ background: "#e8f0fb", color: "#003781", borderRadius: 4,
          padding: "2px 7px", fontSize: 11, fontWeight: 600,
          maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={chunk.chunk_id}>{chunk.chunk_id}</span>
        <span style={{ fontSize: 12, color: "#5a6a85" }}>📄 {chunk.section || "—"}</span>
        <span style={{ background: "#f0f4fb", color: "#5a6a85", borderRadius: 4, padding: "2px 7px", fontSize: 11 }}>
          {chunk.tokens} token
        </span>
        {chunk.note && (
          <span style={{ background: "#fff3cd", color: "#856404", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>
            📌 {chunk.note}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing((v) => !v)}
          style={{ background: editing ? "#e8f0fb" : "none", border: "1px solid #c5d8f5",
            borderRadius: 4, padding: "3px 10px", fontSize: 12, color: "#003781", cursor: "pointer" }}>
          ✏️ Metadati
        </button>
        <button onClick={() => onDelete(chunk.id)}
          style={{ background: "none", border: "1px solid #ffbdbd", borderRadius: 4,
            padding: "3px 10px", fontSize: 12, color: "#c0392b", cursor: "pointer" }}>
          🗑️
        </button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#003781", marginBottom: 2 }}>{chunk.heading}</div>
      {chunk.article && chunk.article !== chunk.heading && (
        <div style={{ fontSize: 11.5, color: "#888" }}>{chunk.article}</div>
      )}

      {editing && (
        <div style={{ marginTop: 12, background: "#f8fafd", borderRadius: 8,
          padding: "14px 16px", border: "1px solid #e8f0fb" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#003781", marginBottom: 12 }}>✏️ Modifica metadati</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Heading</label>
            <input value={heading} onChange={(e) => setHeading(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d9e0",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none", color: "#2c3e50" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Nota per il retriever
            </label>
            <p style={{ fontSize: 11, color: "#9aa5b4", margin: "0 0 6px 0" }}>
              Es: <code>includi sempre</code> · <code>escludi sempre</code> · lascia vuoto per comportamento normale
            </p>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Es. includi sempre"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d9e0",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, outline: "none", color: "#2c3e50" }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background: saving ? "#c8d4e8" : "#003781", color: "#fff", border: "none",
                borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Salvataggio…" : "💾 Salva"}
            </button>
            <button onClick={() => { setEditing(false); setNote(chunk.note ?? ""); setHeading(chunk.heading); }}
              style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
                padding: "7px 16px", fontSize: 13, color: "#5a6a85", cursor: "pointer" }}>
              Annulla
            </button>
            {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith("✓") ? "#2e7d32" : "#c0392b" }}>{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProductCard ─────────────────────────────────────────────────────────────

function ProductCard({ product, onRename, onSelect }: {
  product: Product;
  onRename: (id: string, name: string, shortName: string) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [shortName, setShortName] = useState(product.short_name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true); setMsg(null);
    try {
      await onRename(product.id, name, shortName);
      setMsg("✓ Salvato"); setEditing(false);
      setTimeout(() => setMsg(null), 2000);
    } catch { setMsg("✗ Errore"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 24,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      border: `1px solid ${editing ? "#003781" : "#e8ecf0"}`, transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#e8f0fb",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📦</div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                style={{ border: "1.5px solid #003781", borderRadius: 6, padding: "6px 10px",
                  fontSize: 14, fontWeight: 600, color: "#2c3e50", outline: "none", width: "100%", boxSizing: "border-box" }} />
              <input value={shortName} onChange={(e) => setShortName(e.target.value)}
                placeholder="Nome breve (opzionale)"
                style={{ border: "1px solid #d1d9e0", borderRadius: 6, padding: "6px 10px",
                  fontSize: 12, color: "#2c3e50", outline: "none", width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: "#003781", color: "#fff", border: "none", borderRadius: 6,
                    padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {saving ? "…" : "Salva"}
                </button>
                <button onClick={() => { setEditing(false); setName(product.name); setShortName(product.short_name ?? ""); }}
                  style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
                    padding: "5px 14px", fontSize: 12, color: "#5a6a85", cursor: "pointer" }}>
                  Annulla
                </button>
                {msg && <span style={{ fontSize: 12, color: msg.startsWith("✓") ? "#2e7d32" : "#c0392b" }}>{msg}</span>}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#2c3e50" }}>{product.name}</div>
              {product.short_name && <div style={{ fontSize: 12, color: "#5a6a85", marginTop: 2 }}>{product.short_name}</div>}
              <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 2, fontFamily: "monospace" }}>{product.id}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#f5f7fa", borderRadius: 8, padding: "8px 12px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#003781" }}>{product.chunk_count}</div>
          <div style={{ fontSize: 11, color: "#9aa5b4" }}>chunk</div>
        </div>
        <div style={{ background: "#f5f7fa", borderRadius: 8, padding: "8px 12px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5a6a85" }}>
            {product.last_updated !== "-" ? new Date(product.last_updated).toLocaleDateString("it-IT") : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#9aa5b4" }}>ultimo upload</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setEditing(true)}
          style={{ flex: 1, background: "none", border: "1px solid #c5d8f5", borderRadius: 6,
            padding: "7px 0", fontSize: 12, color: "#003781", cursor: "pointer" }}>
          ✏️ Rinomina
        </button>
        <button onClick={() => onSelect(product.id)}
          style={{ flex: 1, background: "#003781", border: "none", borderRadius: 6,
            padding: "7px 0", fontSize: 12, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          ⬆️ Carica doc
        </button>
      </div>
    </div>
  );
}

// ─── AdminShell ───────────────────────────────────────────────────────────────

export default function AdminShell() {
  const [tab, setTab] = useState<Tab>("upload");

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [uploadMode, setUploadMode] = useState<"replace" | "append">("replace");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunks
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [filterProduct, setFilterProduct] = useState("all");
  const [search, setSearch] = useState("");

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductShort, setNewProductShort] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Config
  const [config, setConfig] = useState({ persona: "", domain: "", guardrails: "", language: "" });
  const [configProductId, setConfigProductId] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      const prods: Product[] = data.products ?? [];
      setProducts(prods);
      if (!selectedProduct && prods.length > 0) setSelectedProduct(prods[0].id);
      if (!configProductId && prods.length > 0) setConfigProductId(prods[0].id);
    } catch { setProducts([]); }
    finally { setProductsLoading(false); }
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

  useEffect(() => {
    if (tab === "chunks") fetchChunks(filterProduct);
  }, [filterProduct]);

  useEffect(() => {
    if (tab === "config" && configProductId) fetchConfig(configProductId);
  }, [configProductId]);

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!file || !selectedProduct) return;
    setUploading(true); setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("productId", selectedProduct);
    form.append("mode", uploadMode);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        const msg = uploadMode === "replace"
          ? `Documento caricato: ${data.count} chunk creati.`
          : `Documento aggiunto: ${data.count} chunk inseriti${data.skipped > 0 ? `, ${data.skipped} duplicati saltati` : ""}.`;
        setUploadResult({ ok: true, message: msg });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchProducts();
      } else {
        setUploadResult({ ok: false, message: data.error ?? "Errore durante il caricamento." });
      }
    } catch { setUploadResult({ ok: false, message: "Errore di rete." }); }
    finally { setUploading(false); }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) return;
    setCreatingProduct(true); setProductMsg(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName.trim(), short_name: newProductShort.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProductMsg({ ok: true, text: `Prodotto "${data.product.name}" creato.` });
        setNewProductName(""); setNewProductShort(""); setShowNewProduct(false);
        fetchProducts();
      } else {
        setProductMsg({ ok: false, text: data.error ?? "Errore." });
      }
    } catch { setProductMsg({ ok: false, text: "Errore di rete." }); }
    finally { setCreatingProduct(false); }
  };

  const handleRenameProduct = async (id: string, name: string, shortName: string) => {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, short_name: shortName }),
    });
    if (!res.ok) throw new Error("Rinomina fallita");
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, name, short_name: shortName } : p));
  };

  const handleSelectProductForUpload = (id: string) => {
    setSelectedProduct(id);
    setTab("upload");
  };

  const handleDeleteChunk = async (id: string) => {
    if (!confirm("Eliminare questo chunk?")) return;
    await fetch(`/api/admin/chunks/${id}`, { method: "DELETE" });
    setChunks((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveChunkMeta = async (id: string, note: string, heading: string) => {
    const res = await fetch(`/api/admin/chunks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, heading }),
    });
    if (!res.ok) throw new Error("Salvataggio fallito");
    setChunks((prev) => prev.map((c) => c.id === id ? { ...c, note: note || null, heading } : c));
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true); setConfigMsg(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: configProductId, ...config }),
      });
      const data = await res.json();
      setConfigMsg(res.ok ? { ok: true, text: "Configurazione salvata." } : { ok: false, text: data.error ?? "Errore." });
    } catch { setConfigMsg({ ok: false, text: "Errore di rete." }); }
    finally { setConfigSaving(false); }
  };

  const filteredChunks = chunks.filter((c) => {
    const s = search.toLowerCase();
    return !s ||
      c.heading.toLowerCase().includes(s) ||
      c.section.toLowerCase().includes(s) ||
      c.article.toLowerCase().includes(s) ||
      (c.note ?? "").toLowerCase().includes(s) ||
      c.chunk_id.toLowerCase().includes(s);
  });

  const selectedProductName = products.find((p) => p.id === selectedProduct)?.name ?? "";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 24px",
        height: 56, display: "flex", alignItems: "center", gap: 14 }}>
        <Image src="/allianz-logo.png" alt="Allianz" width={30} height={30} style={{ objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: "#003781" }}>UltrAI – Admin Panel</span>
        <span style={{ background: "#fef3cd", color: "#856404", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>ADMIN</span>
        <div style={{ flex: 1 }} />
        <a href="/chat" style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6,
          padding: "6px 14px", fontSize: 13, color: "#5a6a85", textDecoration: "none" }}>
          ← Torna alla chat
        </a>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ color: "#003781", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Gestione Knowledge Base</h1>
        <p style={{ color: "#5a6a85", fontSize: 14, marginBottom: 28 }}>
          Carica documenti, visualizza i chunk indicizzati e gestisci i prodotti.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #e0e0e0", marginBottom: 28 }}>
          {([
            { id: "upload", label: "⬆️ Upload documento" },
            { id: "chunks", label: "📄 Chunk indicizzati" },
            { id: "products", label: "📦 Prodotti" },
            { id: "config", label: "⚙️ Configurazione" },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: "none", border: "none",
                borderBottom: tab === t.id ? "2px solid #003781" : "2px solid transparent",
                marginBottom: -2, padding: "10px 20px", fontSize: 14,
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? "#003781" : "#5a6a85", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB UPLOAD ── */}
        {tab === "upload" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 640,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#2c3e50", marginBottom: 20 }}>
              Carica documento .docx
            </h2>

            {/* Selezione prodotto */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Prodotto di destinazione
              </label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #d1d9e0", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none", background: "#fff" }}>
                {products.length === 0 && <option value="">— Nessun prodotto —</option>}
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {selectedProduct && (
                <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>
                  {products.find((p) => p.id === selectedProduct)?.chunk_count ?? 0} chunk già presenti
                </div>
              )}
            </div>

            {/* Modalità upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 10 }}>
                Modalità di caricamento
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {([
                  { value: "append", label: "➕ Aggiungi", desc: "Aggiunge i nuovi chunk senza eliminare quelli esistenti. Usa per caricare documenti multipli sullo stesso prodotto." },
                  { value: "replace", label: "🔄 Sostituisci", desc: "Elimina tutti i chunk esistenti e li sostituisce con quelli del nuovo documento." },
                ] as const).map((opt) => (
                  <div key={opt.value}
                    onClick={() => setUploadMode(opt.value)}
                    style={{ flex: 1, border: `2px solid ${uploadMode === opt.value ? "#003781" : "#e0e0e0"}`,
                      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                      background: uploadMode === opt.value ? "#f0f6ff" : "#fff",
                      transition: "all 0.15s" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: uploadMode === opt.value ? "#003781" : "#2c3e50", marginBottom: 4 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.45 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* File picker */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                File documento (.docx)
              </label>
              <div style={{ border: "2px dashed #b8c9e8", borderRadius: 8, padding: "28px 20px",
                textAlign: "center", cursor: "pointer", background: file ? "#f0f8ff" : "#fafcff" }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".docx")) setFile(f); }}>
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
                      Trascina il file qui o <span style={{ color: "#003781", fontWeight: 600 }}>clicca per sfogliare</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9aa5b4", marginTop: 4 }}>Solo .docx</div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".docx" style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            {/* Riepilogo prima di caricare */}
            {file && selectedProduct && (
              <div style={{ background: "#f0f6ff", border: "1px solid #c5d8f5", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#003781", marginBottom: 16 }}>
                <strong>{uploadMode === "append" ? "➕ Aggiungi" : "🔄 Sostituisci"}</strong>
                {" · "}{file.name}{" → "}<strong>{selectedProductName}</strong>
              </div>
            )}

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
                color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600,
                cursor: !file || !selectedProduct || uploading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {uploading ? (
                <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  animation: "spin 0.8s linear infinite" }} />Upload in corso…</>
              ) : (
                `⬆️ ${uploadMode === "append" ? "Aggiungi documento" : "Sostituisci e ricarica"}`
              )}
            </button>
          </div>
        )}

        {/* ── TAB CHUNKS ── */}
        {tab === "chunks" && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}
                style={{ border: "1.5px solid #d1d9e0", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#2c3e50", background: "#fff", outline: "none" }}>
                <option value="all">Tutti i prodotti</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" placeholder="Cerca in heading / sezione / nota / id…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: "1.5px solid #d1d9e0", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#2c3e50", background: "#fff", outline: "none", minWidth: 280 }} />
              <span style={{ fontSize: 13, color: "#9aa5b4", alignSelf: "center" }}>
                {filteredChunks.length} chunk trovati
              </span>
              <button onClick={() => fetchChunks(filterProduct)}
                style={{ background: "none", border: "1px solid #d1d9e0", borderRadius: 6,
                  padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#5a6a85", marginLeft: "auto" }}>
                🔄 Aggiorna
              </button>
            </div>
            {chunksLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9aa5b4" }}>Caricamento chunk…</div>
            ) : filteredChunks.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center",
                color: "#9aa5b4", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                Nessun chunk trovato. Carica un documento dalla tab Upload.
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

        {/* ── TAB PRODUCTS ── */}
        {tab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: "#5a6a85" }}>
                {products.length} prodott{products.length === 1 ? "o" : "i"} configurati
              </div>
              <button onClick={() => setShowNewProduct((v) => !v)}
                style={{ background: "#003781", color: "#fff", border: "none", borderRadius: 8,
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nuovo prodotto
              </button>
            </div>

            {/* Form nuovo prodotto */}
            {showNewProduct && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "2px solid #003781" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#003781", marginBottom: 16 }}>
                  + Nuovo prodotto
                </h3>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Nome completo *
                    </label>
                    <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Es. Catastrofi naturali Impresa"
                      style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #d1d9e0",
                        borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Nome breve (opzionale)
                    </label>
                    <input value={newProductShort} onChange={(e) => setNewProductShort(e.target.value)}
                      placeholder="Es. CNI"
                      style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #d1d9e0",
                        borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none" }} />
                  </div>
                </div>
                {productMsg && (
                  <div style={{ fontSize: 13, color: productMsg.ok ? "#2e7d32" : "#c0392b", marginBottom: 10 }}>
                    {productMsg.ok ? "✓ " : "✗ "}{productMsg.text}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreateProduct} disabled={creatingProduct || !newProductName.trim()}
                    style={{ background: !newProductName.trim() ? "#c8d4e8" : "#003781", color: "#fff",
                      border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600,
                      cursor: !newProductName.trim() ? "not-allowed" : "pointer" }}>
                    {creatingProduct ? "Creazione…" : "Crea prodotto"}
                  </button>
                  <button onClick={() => { setShowNewProduct(false); setNewProductName(""); setNewProductShort(""); setProductMsg(null); }}
                    style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 8,
                      padding: "10px 20px", fontSize: 14, color: "#5a6a85", cursor: "pointer" }}>
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {productsLoading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#9aa5b4" }}>Caricamento prodotti…</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {products.map((product) => (
                  <ProductCard key={product.id} product={product}
                    onRename={handleRenameProduct}
                    onSelect={handleSelectProductForUpload} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONFIG ── */}
        {tab === "config" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Prodotto da configurare
              </label>
              <select value={configProductId} onChange={(e) => setConfigProductId(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #d1d9e0", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, color: "#2c3e50", outline: "none", background: "#fff", marginBottom: 20 }}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {configLoading ? <div style={{ color: "#888", fontSize: 13 }}>Caricamento...</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {[
                  { key: "persona" as const, label: "Persona", hint: "Ruolo e tono dell'assistente.", rows: 4 },
                  { key: "domain" as const, label: "Dominio / Contesto prodotto", hint: "Prodotto e caratteristiche principali.", rows: 5 },
                  { key: "guardrails" as const, label: "Guardrail aggiuntivi", hint: "Regole extra (si sommano a quelle di default).", rows: 4 },
                  { key: "language" as const, label: "Lingua e stile", hint: "Lingua, registro e formato.", rows: 3 },
                ].map((field) => (
                  <div key={field.key}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#2c3e50", marginBottom: 4 }}>{field.label}</label>
                    <p style={{ fontSize: 12, color: "#9aa5b4", marginBottom: 6 }}>{field.hint}</p>
                    <textarea value={config[field.key]}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
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
                <button onClick={handleSaveConfig} disabled={configSaving}
                  style={{ background: configSaving ? "#c8d4e8" : "#003781", color: "#fff", border: "none",
                    borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600,
                    cursor: configSaving ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
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
