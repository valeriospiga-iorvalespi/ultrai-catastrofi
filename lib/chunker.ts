/**
 * lib/chunker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Elabora documenti assicurativi e produce chunk semanticamente coerenti
 * per il retrieval RAG.
 *
 * Formati supportati:
 *   .docx  →  mammoth → HTML → parser semantico avanzato
 *             Logica identica alla chunkizzazione manuale CNI:
 *             - rilevamento automatico stili Word (fallback a heading standard)
 *             - prefisso chunk_id derivato dal titolo del documento
 *             - chunk di dimensioni medie (TOKEN_MIN 150 / TOKEN_MAX 600)
 *             - glossario → chunk raggruppati per dimensione
 *             - articoli brevi → merge automatico col precedente
 *             - overflow → split con "(continua)"
 *             - grassetto preservato come **Markdown**
 *   .md    →  split per "## CHUNK" (formato pre-chunked CNI)
 *             oppure split generico per ## / ### se non è pre-chunked
 *
 * Dipendenze:  mammoth  node-html-parser
 * Next.js 14 / TypeScript
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mammoth from "mammoth";
import { parse, HTMLElement, NodeType } from "node-html-parser";

// ─── Interfaccia pubblica ────────────────────────────────────────────────────

export interface Chunk {
  /** Slug leggibile, es. "cni-art31-garanzie-base" */
  id: string;
  /** Titolo della sezione H1 corrente */
  section: string;
  /** Descrizione granulare del contenuto (topic) */
  article: string;
  /** Heading che ha aperto questo chunk */
  heading: string;
  /** Testo completo del chunk in formato Markdown */
  text: string;
  /** Stima token: Math.ceil(text.length / 4) */
  tokens: number;
}

// ─── Costanti ────────────────────────────────────────────────────────────────

const TOKEN_MIN = 150;
const TOKEN_MAX = 600;

// ─── Utility ─────────────────────────────────────────────────────────────────

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

// ─── Derivazione prefisso dal titolo documento ───────────────────────────────

/**
 * Ricava un prefisso breve (2-4 char) dal titolo del documento
 * da usare nei chunk_id.
 * Es: "Catastrofi naturali Impresa" → "CNI"
 *     "UltrAI Salute"               → "US"
 *     "Casa e Patrimonio"           → "CP"
 */
function derivePrefix(title: string): string {
  const stopWords = new Set([
    "e", "di", "da", "a", "il", "la", "le", "lo", "i", "gli", "un", "una",
    "del", "della", "dei", "degli", "delle", "al", "ai", "alla", "alle",
    "per", "con", "su", "tra", "fra", "in",
  ]);
  const words = title
    .replace(/[^a-zA-ZÀ-ú\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()));
  const initials = words.map((w) => w[0].toUpperCase()).slice(0, 4).join("");
  return initials || "DOC";
}

// ─── Style map mammoth ────────────────────────────────────────────────────────

/**
 * Restituisce la style map per mammoth con tutti i nomi stile
 * comuni nei documenti Allianz e nei documenti Word standard IT/EN.
 */
function buildStyleMap(): string[] {
  return [
    // Stili Allianz
    "p[style-name='_Titolo 1'] => h1",
    "p[style-name='_Titolo 2'] => h2",
    "p[style-name='_Titolo 3'] => h3",
    // Word standard IT
    "p[style-name='Titolo 1'] => h1",
    "p[style-name='Titolo 2'] => h2",
    "p[style-name='Titolo 3'] => h3",
    // Word standard EN
    "p[style-name='Heading 1'] => h1",
    "p[style-name='Heading 2'] => h2",
    "p[style-name='Heading 3'] => h3",
    // Elenchi noti
    "p[style-name='elenco10'] => ul > li",
    "p[style-name='List Paragraph'] => ul > li",
    "p[style-name='Paragrafo elenco1'] => ul > li",
    "p[style-name='Elenco puntato'] => ul > li",
    // Indice → skip
    "p[style-name='toc 1'] => p.skip",
    "p[style-name='toc 2'] => p.skip",
    "p[style-name='toc 3'] => p.skip",
    "p[style-name='Plain Text'] => p.skip",
  ];
}

// ─── chunk_id leggibile ───────────────────────────────────────────────────────

/**
 * Produce un chunk_id nel formato PREFIX-KEYWORD o PREFIX-NNNNN.
 * Riconosce pattern comuni nei documenti assicurativi italiani.
 */
function makeChunkId(prefix: string, counter: number, heading: string): string {
  const h = heading.toLowerCase();

  const artMatch = heading.match(/art(?:icolo)?\.?\s*(\d[\d.]*)/i);
  if (artMatch) {
    const num = artMatch[1].replace(/\./g, "").slice(0, 5);
    return `${prefix}-ART${num}`;
  }
  if (/gloss/i.test(h))       return `${prefix}-GLOSS-${String(counter).padStart(2, "0")}`;
  if (/introduz/i.test(h))    return `${prefix}-INTRO`;
  if (/premio/i.test(h))      return `${prefix}-PREMIO`;
  if (/sinistro|obblighi/i.test(h)) return `${prefix}-SIN-${String(counter).padStart(2, "0")}`;
  if (/esclu|non.assic/i.test(h))   return `${prefix}-EXCL-${String(counter).padStart(2, "0")}`;
  if (/limit/i.test(h))       return `${prefix}-LIM-${String(counter).padStart(2, "0")}`;
  if (/territorial/i.test(h)) return `${prefix}-TERR`;
  if (/durata|decorrenza|disdetta/i.test(h)) return `${prefix}-DUR`;
  if (/disposi/i.test(h))     return `${prefix}-DISP`;
  if (/opzion|garanzia/i.test(h))   return `${prefix}-GAR-${String(counter).padStart(2, "0")}`;

  return `${prefix}-${String(counter).padStart(5, "0")}`;
}

// ─── Stato di costruzione chunk ──────────────────────────────────────────────

interface ChunkState {
  section: string;
  article: string;
  heading: string;
  chunkId: string;
  lines: string[];
}

function stateTokens(s: ChunkState): number {
  return countTokens(s.lines.join("\n"));
}

function newChunkState(
  section: string, article: string, heading: string, chunkId: string
): ChunkState {
  return { section, article, heading, chunkId, lines: [heading] };
}

function appendLine(state: ChunkState, text: string): void {
  const t = text.trim();
  if (t) state.lines.push(t);
}

// ─── Contesto parser ──────────────────────────────────────────────────────────

interface ParserContext {
  prefix: string;
  counter: number;
  currentSection: string;
  currentArticle: string;
  currentH2: string;
  building: ChunkState | null;
  chunks: Chunk[];
  lastChunk: Chunk | null;
  inPrologue: boolean;
  glossaryGroup: { term: string; lines: string[] }[];
  glossaryTerm: string;
  glossaryLines: string[];
}

// ─── Flush ────────────────────────────────────────────────────────────────────

function flushChunk(state: ChunkState, ctx: ParserContext, forceMerge = false): void {
  const text = state.lines.join("\n").trim();
  if (!text) return;
  const tokens = countTokens(text);

  if (tokens < TOKEN_MIN && ctx.lastChunk && forceMerge) {
    // Merge col chunk precedente
    ctx.lastChunk.text += "\n\n" + text;
    ctx.lastChunk.tokens = countTokens(ctx.lastChunk.text);
    if (state.article && state.article !== ctx.lastChunk.article) {
      ctx.lastChunk.article += " / " + state.article;
    }
    return;
  }

  ctx.counter++;
  const id = slugify(state.chunkId || makeChunkId(ctx.prefix, ctx.counter, state.heading));
  const chunk: Chunk = {
    id,
    section: state.section,
    article: state.article || state.heading,
    heading: state.heading,
    text,
    tokens,
  };
  ctx.chunks.push(chunk);
  ctx.lastChunk = chunk;
}

function checkOverflow(ctx: ParserContext): void {
  if (!ctx.building) return;
  if (stateTokens(ctx.building) <= TOKEN_MAX) return;

  const mid = Math.floor(ctx.building.lines.length / 2) || 1;
  const overflowLines = ctx.building.lines.splice(mid);
  flushChunk(ctx.building, ctx, false);

  const continuaHeading = `${ctx.building.heading} (continua)`;
  ctx.counter++;
  ctx.building = {
    section: ctx.currentSection,
    article: ctx.currentArticle,
    heading: continuaHeading,
    chunkId: makeChunkId(ctx.prefix, ctx.counter, continuaHeading),
    lines: [continuaHeading, ...overflowLines],
  };
}

// ─── Glossario ────────────────────────────────────────────────────────────────

function processGlossaryParagraph(ctx: ParserContext, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const colonIdx = trimmed.indexOf(":");
  const isNewTerm = colonIdx > 0 && colonIdx < 80;

  if (isNewTerm) {
    if (ctx.glossaryTerm) {
      ctx.glossaryGroup.push({ term: ctx.glossaryTerm, lines: [...ctx.glossaryLines] });
      ctx.glossaryTerm = "";
      ctx.glossaryLines = [];
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

  // Flush del gruppo se supera TOKEN_MAX
  const groupText = ctx.glossaryGroup
    .map((g) => `**${g.term}:** ${g.lines.join(" ")}`)
    .join("\n\n");
  if (countTokens(groupText) >= TOKEN_MAX) flushGlossaryGroup(ctx);
}

function flushGlossaryGroup(ctx: ParserContext): void {
  if (ctx.glossaryGroup.length === 0) return;
  const first = ctx.glossaryGroup[0].term;
  const last  = ctx.glossaryGroup[ctx.glossaryGroup.length - 1].term;
  const heading = ctx.glossaryGroup.length === 1
    ? `Glossario — ${first}`
    : `Glossario — ${first} / ${last}`;
  const bodyLines = ctx.glossaryGroup.map(
    (g) => `**${g.term}:** ${g.lines.join(" ").trim()}`
  );
  const text = [heading, ...bodyLines].join("\n\n");
  ctx.counter++;
  const chunk: Chunk = {
    id: slugify(makeChunkId(ctx.prefix, ctx.counter, "glossario") + `-${ctx.counter}`),
    section: "GLOSSARIO",
    article: `Definizioni: ${first}–${last}`,
    heading,
    text,
    tokens: countTokens(text),
  };
  ctx.chunks.push(chunk);
  ctx.lastChunk = chunk;
  ctx.glossaryGroup = [];
}

function flushGlossary(ctx: ParserContext): void {
  if (ctx.glossaryTerm) {
    ctx.glossaryGroup.push({ term: ctx.glossaryTerm, lines: [...ctx.glossaryLines] });
    ctx.glossaryTerm = "";
    ctx.glossaryLines = [];
  }
  if (ctx.glossaryGroup.length > 0) flushGlossaryGroup(ctx);
}

// ─── Conversione nodo → Markdown ─────────────────────────────────────────────

/**
 * Converte un nodo <p> in testo Markdown preservando grassetto e corsivo.
 */
function paragraphToMarkdown(node: HTMLElement): string {
  const parts: string[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const t = child.text.replace(/\s+/g, " ");
      if (t.trim()) parts.push(t);
    } else if (child.nodeType === NodeType.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase() ?? "";
      if (tag === "strong" || tag === "b") {
        parts.push(`**${el.text.trim()}**`);
      } else if (tag === "em" || tag === "i") {
        parts.push(`_${el.text.trim()}_`);
      } else {
        parts.push(el.text.replace(/\s+/g, " ").trim());
      }
    }
  });
  return parts.join("").trim();
}

function getTextContent(node: HTMLElement): string {
  return node.text.replace(/\s+/g, " ").trim();
}

// ─── Processore nodi HTML ─────────────────────────────────────────────────────

function processNode(node: HTMLElement, ctx: ParserContext): void {
  const tag = node.tagName?.toLowerCase() ?? "";
  if (node.classList?.contains("skip")) return;

  switch (tag) {
    case "h1": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) { flushChunk(ctx.building, ctx, true); ctx.building = null; }
      ctx.currentSection = getTextContent(node);
      ctx.currentArticle = "";
      ctx.currentH2 = "";
      break;
    }

    case "h2": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) flushChunk(ctx.building, ctx, true);
      ctx.currentArticle = getTextContent(node);
      ctx.currentH2 = ctx.currentArticle;
      ctx.counter++;
      ctx.building = newChunkState(
        ctx.currentSection,
        ctx.currentArticle,
        ctx.currentArticle,
        makeChunkId(ctx.prefix, ctx.counter, ctx.currentArticle)
      );
      break;
    }

    case "h3": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      if (ctx.building) flushChunk(ctx.building, ctx, true);
      const h3text = getTextContent(node);
      const heading = ctx.currentH2 ? `${ctx.currentH2} > ${h3text}` : h3text;
      ctx.counter++;
      ctx.building = newChunkState(
        ctx.currentSection,
        h3text,
        heading,
        makeChunkId(ctx.prefix, ctx.counter, h3text)
      );
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
        ctx.counter++;
        ctx.building = newChunkState(
          ctx.currentSection,
          ctx.currentArticle,
          ctx.currentArticle || ctx.currentSection,
          makeChunkId(ctx.prefix, ctx.counter, ctx.currentArticle || ctx.currentSection)
        );
      }
      node.querySelectorAll("li").forEach((li) => {
        const t = getTextContent(li as HTMLElement);
        if (t) appendLine(ctx.building!, `• ${t}`);
      });
      checkOverflow(ctx);
      break;
    }

    case "p": {
      const mdText = paragraphToMarkdown(node);
      if (!mdText) return;
      if (ctx.inPrologue) { processGlossaryParagraph(ctx, mdText); return; }
      if (!ctx.building) {
        ctx.counter++;
        ctx.building = newChunkState(
          ctx.currentSection,
          ctx.currentArticle,
          ctx.currentArticle || ctx.currentSection || "Introduzione",
          makeChunkId(ctx.prefix, ctx.counter, ctx.currentArticle || "introduzione")
        );
      }
      appendLine(ctx.building, mdText);
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

// ─── Rilevamento titolo documento ─────────────────────────────────────────────

function detectDocumentTitle(html: string): string {
  const root = parse(html);
  // Cerca il primo testo breve utile (titolo cover page o primo H1)
  const candidates = root.querySelectorAll("h1, p");
  for (const node of candidates) {
    const text = node.text.replace(/\s+/g, " ").trim();
    // Ignora righe troppo corte (numeri, date) o troppo lunghe (paragrafi)
    if (text.length >= 5 && text.length <= 120) return text;
  }
  return "Documento";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT DOCX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Converte un buffer .docx in chunk RAG semanticamente coerenti.
 *
 * La logica replica la chunkizzazione manuale del documento CNI del 23/03/2026:
 * - prefisso chunk_id auto-derivato dal titolo (es. "CNI", "US", "CP")
 * - glossario raggruppato in chunk di dimensioni medie
 * - grassetto preservato come **Markdown**
 * - articoli brevi fusi col precedente (TOKEN_MIN 150)
 * - articoli lunghi spezzati con "(continua)" (TOKEN_MAX 600)
 */
export async function chunkDocxBuffer(buffer: Buffer): Promise<Chunk[]> {
  // Passata 1: titolo minimo per derivare il prefisso
  const { value: htmlMin } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: ["p[style-name='toc 1'] => p.skip", "p[style-name='toc 2'] => p.skip"] }
  );
  const docTitle = detectDocumentTitle(htmlMin);
  const prefix = derivePrefix(docTitle);

  // Passata 2: conversione completa con styleMap estesa
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: buildStyleMap() }
  );

  const root = parse(html);
  const ctx: ParserContext = {
    prefix,
    counter: 0,
    currentSection: "",
    currentArticle: "",
    currentH2: "",
    building: null,
    chunks: [],
    lastChunk: null,
    inPrologue: true,
    glossaryGroup: [],
    glossaryTerm: "",
    glossaryLines: [],
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      processNode(node as HTMLElement, ctx);
    }
  });

  if (ctx.inPrologue) flushGlossary(ctx);
  if (ctx.building) flushChunk(ctx.building, ctx, true);

  deduplicateSlugs(ctx.chunks);
  return ctx.chunks;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

function extractMdMeta(lines: string[]): { chunkId: string; sezione: string; topic: string } {
  let chunkId = "", sezione = "", topic = "";
  for (const line of lines) {
    const m = line.match(/\*\*chunk_id:\*\*\s*(.+)/);  if (m) chunkId = m[1].trim();
    const s = line.match(/\*\*sezione:\*\*\s*(.+)/);   if (s) sezione = s[1].trim();
    const t = line.match(/\*\*topic:\*\*\s*(.+)/);     if (t) topic   = t[1].trim();
  }
  return { chunkId, sezione, topic };
}

function isPreChunked(text: string): boolean {
  return /^## CHUNK\s/m.test(text);
}

function parseMdPreChunked(text: string): Chunk[] {
  const blocks = text.split(/(?=^## CHUNK\s)/m).filter((b) => b.trim());
  const chunks: Chunk[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const headingLine = lines[0].replace(/^##\s+/, "").trim();
    const { chunkId, sezione, topic } = extractMdMeta(lines);
    const bodyLines = lines.filter((l) => !/^\*\*(chunk_id|sezione|topic):\*\*/.test(l));
    const bodyText = bodyLines.join("\n").trim();
    chunks.push({
      id: chunkId ? slugify(chunkId) : slugify(headingLine),
      section: sezione || headingLine,
      article: topic || headingLine,
      heading: headingLine,
      text: bodyText,
      tokens: countTokens(bodyText),
    });
  }
  deduplicateSlugs(chunks);
  return chunks;
}

function parseMdGeneric(text: string): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let currentSection = "", currentArticle = "", currentHeading = "";
  let buffer: string[] = [];
  let lastChunk: Chunk | null = null;

  function flush(forceMerge: boolean) {
    const content = buffer.join("\n").trim();
    if (!content) return;
    const tokens = countTokens(content);
    if (tokens < TOKEN_MIN && lastChunk && forceMerge) {
      lastChunk.text += "\n\n" + content;
      lastChunk.tokens = countTokens(lastChunk.text);
      return;
    }
    const chunk: Chunk = {
      id: slugify(currentHeading || currentSection || "sezione"),
      section: currentSection, article: currentArticle, heading: currentHeading,
      text: content, tokens,
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
      flush(true); currentSection = h1[1].trim(); currentArticle = ""; currentHeading = currentSection; buffer = [];
    } else if (h2) {
      flush(true); currentArticle = h2[1].trim(); currentHeading = currentArticle; buffer = [line];
    } else if (h3) {
      flush(true); currentHeading = h3[1].trim(); buffer = [line];
    } else {
      buffer.push(line);
      if (countTokens(buffer.join("\n")) > TOKEN_MAX) { flush(false); buffer = []; }
    }
  }
  flush(true);
  deduplicateSlugs(chunks);
  return chunks;
}

export async function chunkMarkdownBuffer(buffer: Buffer): Promise<Chunk[]> {
  const text = buffer.toString("utf-8");
  if (isPreChunked(text)) return parseMdPreChunked(text);
  return parseMdGeneric(text);
}
