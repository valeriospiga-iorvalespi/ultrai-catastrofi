/**
 * lib/chunker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Elabora documenti assicurativi e produce chunk semanticamente coerenti
 * per il retrieval RAG.
 *
 * Formati supportati:
 *   .docx  →  mammoth → HTML → parser strutturato
 *   .md    →  split per heading ## CHUNK (formato CNI chunked)
 *             oppure split generico per ## / ### se non è pre-chunked
 *   .pdf   →  pdfjs-dist (legacy) → testo grezzo → split per token
 *
 * Dipendenze:  mammoth  node-html-parser  pdfjs-dist
 * Next.js 14 / TypeScript
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mammoth from "mammoth";
import { parse, HTMLElement, NodeType } from "node-html-parser";
// pdfjs-dist/legacy funziona in Node.js puro senza canvas o DOMMatrix
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// ─── Interfaccia pubblica ────────────────────────────────────────────────────

export interface Chunk {
  /** Slug leggibile, es. "art-3-1-1-sisma" */
  id: string;
  /** Titolo della sezione H1 corrente, es. "3 - GLI EVENTI ASSICURATI" */
  section: string;
  /** Testo del H2 corrente (article) */
  article: string;
  /** H2 o H3 che ha aperto questo chunk */
  heading: string;
  /** Testo completo del chunk, heading come prima riga */
  text: string;
  /** Stima token: Math.ceil(text.length / 4) */
  tokens: number;
}

// ─── Costanti ────────────────────────────────────────────────────────────────

const TOKEN_MIN = 80;
const TOKEN_MAX = 400;

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Converte una stringa in slug ASCII minuscolo senza accenti.
 * Es. "Art. 3.1 – Sisma" → "art-3-1-sisma"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Deduplicazione slug: aggiunge suffisso -2, -3 … se necessario */
function deduplicateSlugs(chunks: Chunk[]): void {
  const slugCount: Record<string, number> = {};
  chunks.forEach((c) => { slugCount[c.id] = (slugCount[c.id] ?? 0) + 1; });
  const slugSeen: Record<string, number> = {};
  chunks.forEach((c) => {
    if (slugCount[c.id] > 1) {
      slugSeen[c.id] = (slugSeen[c.id] ?? 0) + 1;
      c.id = `${c.id}-${slugSeen[c.id]}`;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER DOCX (logica originale invariata)
// ═══════════════════════════════════════════════════════════════════════════════

interface ChunkState {
  section: string;
  article: string;
  heading: string;
  lines: string[];
}

function stateTokens(s: ChunkState): number {
  return countTokens(s.lines.join("\n"));
}

function flushChunk(
  state: ChunkState,
  chunks: Chunk[],
  prevChunk: Chunk | null,
  forceMerge = false
): Chunk | null {
  const text = state.lines.join("\n").trim();
  if (!text) return prevChunk;
  const tokens = countTokens(text);
  if (tokens < TOKEN_MIN && prevChunk && forceMerge) {
    const merged = prevChunk.text + "\n" + text;
    prevChunk.text = merged;
    prevChunk.tokens = countTokens(merged);
    return prevChunk;
  }
  const chunk: Chunk = {
    id: slugify(state.heading),
    section: state.section,
    article: state.article,
    heading: state.heading,
    text,
    tokens,
  };
  chunks.push(chunk);
  return chunk;
}

interface ParserContext {
  currentSection: string;
  currentArticle: string;
  currentH2: string;
  building: ChunkState | null;
  chunks: Chunk[];
  lastChunk: Chunk | null;
  inPrologue: boolean;
  glossaryLines: string[];
  inGlossaryTerm: boolean;
  glossaryTerm: string;
}

function newState(section: string, article: string, heading: string): ChunkState {
  return { section, article, heading, lines: [heading] };
}

function appendText(state: ChunkState, text: string): void {
  const line = text.trim();
  if (line) state.lines.push(line);
}

function processGlossaryParagraph(ctx: ParserContext, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0 && colonIdx < 80) {
    if (ctx.glossaryTerm) {
      const gl = ctx.glossaryLines.join("\n").trim();
      if (gl) {
        const heading = `GLOSSARIO - ${ctx.glossaryTerm}`;
        const chunk: Chunk = {
          id: slugify(heading),
          section: "GLOSSARIO",
          article: "Definizioni",
          heading,
          text: `${heading}\n${gl}`,
          tokens: 0,
        };
        chunk.tokens = countTokens(chunk.text);
        ctx.chunks.push(chunk);
        ctx.lastChunk = chunk;
      }
    }
    ctx.glossaryTerm = trimmed.slice(0, colonIdx).trim();
    ctx.glossaryLines = [trimmed.slice(colonIdx + 1).trim()];
  } else {
    if (!ctx.glossaryTerm) {
      ctx.glossaryTerm = trimmed;
      ctx.glossaryLines = [];
    } else {
      ctx.glossaryLines.push(trimmed);
    }
  }
}

function flushGlossary(ctx: ParserContext): void {
  if (!ctx.glossaryTerm) return;
  const gl = ctx.glossaryLines.join("\n").trim();
  const heading = `GLOSSARIO - ${ctx.glossaryTerm}`;
  const text = gl ? `${heading}\n${gl}` : heading;
  const chunk: Chunk = {
    id: slugify(heading),
    section: "GLOSSARIO",
    article: "Definizioni",
    heading,
    text,
    tokens: countTokens(text),
  };
  ctx.chunks.push(chunk);
  ctx.lastChunk = chunk;
  ctx.glossaryTerm = "";
  ctx.glossaryLines = [];
}

function checkOverflow(ctx: ParserContext): void {
  if (!ctx.building) return;
  if (stateTokens(ctx.building) <= TOKEN_MAX) return;
  const continuaHeading = `${ctx.building.heading} (continua)`;
  const overflowLines: string[] = [];
  const mid = Math.floor(ctx.building.lines.length / 2) || 1;
  overflowLines.push(...ctx.building.lines.splice(mid));
  ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, false);
  ctx.building = {
    section: ctx.currentSection,
    article: ctx.currentArticle,
    heading: continuaHeading,
    lines: [continuaHeading, ...overflowLines],
  };
}

function getTextContent(node: HTMLElement): string {
  return node.text.replace(/\s+/g, " ").trim();
}

function processNode(node: HTMLElement, ctx: ParserContext): void {
  const tag = node.tagName?.toLowerCase() ?? "";
  if (node.classList?.contains("skip")) return;

  switch (tag) {
    case "h1": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
        ctx.building = null;
      }
      ctx.currentSection = getTextContent(node);
      ctx.currentArticle = "";
      ctx.currentH2 = "";
      break;
    }
    case "h2": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
      }
      ctx.currentArticle = getTextContent(node);
      ctx.currentH2 = ctx.currentArticle;
      ctx.building = newState(ctx.currentSection, ctx.currentArticle, ctx.currentArticle);
      break;
    }
    case "h3": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
      }
      const h3text = getTextContent(node);
      const heading = ctx.currentH2 ? `${ctx.currentH2} > ${h3text}` : h3text;
      ctx.building = newState(ctx.currentSection, ctx.currentArticle, heading);
      break;
    }
    case "ul": {
      if (ctx.inPrologue) {
        node.querySelectorAll("li").forEach((li) => {
          processGlossaryParagraph(ctx, getTextContent(li as HTMLElement));
        });
        return;
      }
      if (!ctx.building) {
        ctx.building = newState(
          ctx.currentSection, ctx.currentArticle,
          ctx.currentArticle || ctx.currentSection
        );
      }
      node.querySelectorAll("li").forEach((li) => {
        const liText = getTextContent(li as HTMLElement);
        if (liText) appendText(ctx.building!, `• ${liText}`);
      });
      checkOverflow(ctx);
      break;
    }
    case "p": {
      const text = getTextContent(node);
      if (!text) return;
      if (ctx.inPrologue) { processGlossaryParagraph(ctx, text); return; }
      if (!ctx.building) {
        ctx.building = newState(
          ctx.currentSection, ctx.currentArticle,
          ctx.currentArticle || ctx.currentSection || "Introduzione"
        );
      }
      appendText(ctx.building, text);
      checkOverflow(ctx);
      break;
    }
    default: {
      node.childNodes.forEach((child) => {
        if (child.nodeType === NodeType.ELEMENT_NODE) {
          processNode(child as HTMLElement, ctx);
        }
      });
    }
  }
}

export async function chunkDocxBuffer(buffer: Buffer): Promise<Chunk[]> {
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='_Titolo 1'] => h1",
        "p[style-name='_Titolo 2'] => h2",
        "p[style-name='_Titolo 3'] => h3",
        "p[style-name='elenco10'] => ul > li",
        "p[style-name='List Paragraph'] => ul > li",
        "p[style-name='Paragrafo elenco1'] => ul > li",
        "p[style-name='toc 1'] => p.skip",
        "p[style-name='toc 2'] => p.skip",
        "p[style-name='Plain Text'] => p.skip",
      ],
    }
  );

  const root = parse(html);
  const ctx: ParserContext = {
    currentSection: "", currentArticle: "", currentH2: "",
    building: null, chunks: [], lastChunk: null,
    inPrologue: true, glossaryLines: [], inGlossaryTerm: false, glossaryTerm: "",
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      processNode(node as HTMLElement, ctx);
    }
  });

  if (ctx.inPrologue) flushGlossary(ctx);
  if (ctx.building) flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);

  deduplicateSlugs(ctx.chunks);
  return ctx.chunks;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estrae metadati dall'header di un chunk pre-strutturato (formato CNI).
 * Cerca righe come:  **chunk_id:** CNI-ART31-GARANZIE-BASE
 *                    **sezione:** 3 — Gli eventi assicurati
 *                    **topic:** ...
 */
function extractMdMeta(
  lines: string[]
): { chunkId: string; sezione: string; topic: string } {
  let chunkId = "";
  let sezione = "";
  let topic = "";
  for (const line of lines) {
    const m = line.match(/\*\*chunk_id:\*\*\s*(.+)/);
    if (m) chunkId = m[1].trim();
    const s = line.match(/\*\*sezione:\*\*\s*(.+)/);
    if (s) sezione = s[1].trim();
    const t = line.match(/\*\*topic:\*\*\s*(.+)/);
    if (t) topic = t[1].trim();
  }
  return { chunkId, sezione, topic };
}

/**
 * Riconosce se il Markdown è nel formato CNI pre-chunked
 * (contiene almeno un'intestazione "## CHUNK").
 */
function isPreChunked(text: string): boolean {
  return /^## CHUNK\s/m.test(text);
}

/**
 * Parser per Markdown CNI pre-chunked.
 * Ogni sezione ## CHUNK … diventa un chunk autonomo.
 * I metadati chunk_id / sezione / topic vengono estratti dall'header.
 */
function parseMdPreChunked(text: string): Chunk[] {
  // Split sulle righe ## CHUNK (inclusa la riga stessa)
  const blocks = text.split(/(?=^## CHUNK\s)/m).filter((b) => b.trim());
  const chunks: Chunk[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const headingLine = lines[0].replace(/^##\s+/, "").trim();

    // Estrai metadati dall'header
    const { chunkId, sezione, topic } = extractMdMeta(lines);

    // Testo pulito: rimuove le righe di metadati (**chunk_id:**, ecc.)
    const bodyLines = lines.filter(
      (l) => !/^\*\*(chunk_id|sezione|topic):\*\*/.test(l)
    );
    const text = bodyLines.join("\n").trim();

    // Inferisci section e article dai metadati o dall'heading
    const sectionVal = sezione || headingLine;
    // "topic" è la descrizione più granulare → article
    const articleVal = topic || headingLine;

    chunks.push({
      id: chunkId ? slugify(chunkId) : slugify(headingLine),
      section: sectionVal,
      article: articleVal,
      heading: headingLine,
      text,
      tokens: countTokens(text),
    });
  }

  deduplicateSlugs(chunks);
  return chunks;
}

/**
 * Parser generico per Markdown non pre-chunked.
 * Split su ## (H2) e ### (H3), con overflow gestito come per docx.
 */
function parseMdGeneric(text: string): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let currentSection = "";
  let currentArticle = "";
  let currentHeading = "";
  let buffer: string[] = [];
  let lastChunk: Chunk | null = null;

  function flush(forceMerge: boolean) {
    const content = buffer.join("\n").trim();
    if (!content) return;
    const tokens = countTokens(content);
    if (tokens < TOKEN_MIN && lastChunk && forceMerge) {
      lastChunk.text += "\n" + content;
      lastChunk.tokens = countTokens(lastChunk.text);
      return;
    }
    const chunk: Chunk = {
      id: slugify(currentHeading || currentSection || "sezione"),
      section: currentSection,
      article: currentArticle,
      heading: currentHeading,
      text: content,
      tokens,
    };
    chunks.push(chunk);
    lastChunk = chunk;
    buffer = [];
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h1) {
      flush(true);
      currentSection = h1[1].trim();
      currentArticle = "";
      currentHeading = currentSection;
      buffer = [];
    } else if (h2) {
      flush(true);
      currentArticle = h2[1].trim();
      currentHeading = currentArticle;
      buffer = [line];
    } else if (h3) {
      flush(true);
      currentHeading = h3[1].trim();
      buffer = [line];
    } else {
      buffer.push(line);
      // Overflow check
      if (countTokens(buffer.join("\n")) > TOKEN_MAX) {
        flush(false);
        buffer = [];
      }
    }
  }
  flush(true);

  deduplicateSlugs(chunks);
  return chunks;
}

/**
 * Entry point per file .md
 * Rileva automaticamente il formato (pre-chunked CNI vs generico).
 */
export async function chunkMarkdownBuffer(buffer: Buffer): Promise<Chunk[]> {
  const text = buffer.toString("utf-8");
  if (isPreChunked(text)) {
    return parseMdPreChunked(text);
  }
  return parseMdGeneric(text);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER PDF
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estrae testo da PDF con pdfjs-dist/legacy (nessuna dipendenza nativa,
 * funziona su Vercel/Node.js senza canvas o DOMMatrix).
 * Suddivide in chunk da TOKEN_MAX token con heading sintetici.
 */
export async function chunkPdfBuffer(
  buffer: Buffer,
  fileName = "documento.pdf"
): Promise<Chunk[]> {
  let rawText: string;
  try {
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str ?? "")
        .join(" ");
      pageTexts.push(pageText);
    }
    rawText = pageTexts.join("\n\n");
  } catch (err) {
    throw new Error(`pdfjs-dist: impossibile estrarre testo dal PDF. ${err}`);
  }

  if (!rawText?.trim()) {
    throw new Error(
      "Il PDF non contiene testo estraibile (potrebbe essere scansionato/immagine)."
    );
  }

  // Normalizza: molteplici spazi/newline → paragrafi separati da \n\n
  const paragraphs = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n\n")
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);

  const baseName = fileName.replace(/\.[^.]+$/, "");
  const chunks: Chunk[] = [];
  let bufLines: string[] = [];
  let chunkIndex = 0;

  function flushPdf() {
    const text = bufLines.join("\n").trim();
    if (!text) return;
    chunkIndex++;
    const heading = `${baseName} — parte ${chunkIndex}`;
    chunks.push({
      id: slugify(heading),
      section: baseName,
      article: baseName,
      heading,
      text: `${heading}\n${text}`,
      tokens: countTokens(text),
    });
    bufLines = [];
  }

  for (const para of paragraphs) {
    bufLines.push(para);
    if (countTokens(bufLines.join("\n")) >= TOKEN_MAX) flushPdf();
  }
  flushPdf();

  deduplicateSlugs(chunks);
  return chunks;
}
