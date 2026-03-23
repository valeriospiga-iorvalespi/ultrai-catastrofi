/**
 * lib/chunker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Elabora documenti assicurativi e produce chunk semanticamente coerenti
 * per il retrieval RAG.
 *
 * Formati supportati:
 *   .docx  →  mammoth → HTML → parser semantico
 *             - prefisso chunk_id auto-derivato dal titolo del documento
 *             - glossario raggruppato per dimensione (non 1 chunk / termine)
 *             - H3 consecutivi sotto lo stesso H2 accumulati nello stesso chunk
 *             - TOKEN_MIN 150 / TOKEN_MAX 600
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
  id: string;
  section: string;
  article: string;
  heading: string;
  text: string;
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

// ─── Prefisso dal titolo ──────────────────────────────────────────────────────

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
  return words.map((w) => w[0].toUpperCase()).slice(0, 4).join("") || "DOC";
}

// ─── chunk_id leggibile ───────────────────────────────────────────────────────

function makeChunkId(prefix: string, counter: number, heading: string): string {
  const artMatch = heading.match(/art(?:icolo)?\.?\s*(\d[\d.]*)/i);
  if (artMatch) return `${prefix}-ART${artMatch[1].replace(/\./g, "").slice(0, 5)}`;

  const h = heading.toLowerCase();
  if (/gloss/i.test(h))                    return `${prefix}-GLOSS-${String(counter).padStart(2, "0")}`;
  if (/introduz/i.test(h))                 return `${prefix}-INTRO`;
  if (/premio/i.test(h))                   return `${prefix}-PREMIO`;
  if (/sinistro|obblighi/i.test(h))        return `${prefix}-SIN-${String(counter).padStart(2, "0")}`;
  if (/esclu|non.assic/i.test(h))          return `${prefix}-EXCL-${String(counter).padStart(2, "0")}`;
  if (/limit/i.test(h))                    return `${prefix}-LIM-${String(counter).padStart(2, "0")}`;
  if (/territorial/i.test(h))              return `${prefix}-TERR`;
  if (/durata|decorrenza|disdetta/i.test(h)) return `${prefix}-DUR`;
  if (/disposi/i.test(h))                  return `${prefix}-DISP`;
  if (/opzion|garanzia/i.test(h))          return `${prefix}-GAR-${String(counter).padStart(2, "0")}`;
  return `${prefix}-${String(counter).padStart(5, "0")}`;
}

// ─── Style map ────────────────────────────────────────────────────────────────

function buildStyleMap(): string[] {
  return [
    "p[style-name='_Titolo 1'] => h1",
    "p[style-name='_Titolo 2'] => h2",
    "p[style-name='_Titolo 3'] => h3",
    "p[style-name='Titolo 1'] => h1",
    "p[style-name='Titolo 2'] => h2",
    "p[style-name='Titolo 3'] => h3",
    "p[style-name='Heading 1'] => h1",
    "p[style-name='Heading 2'] => h2",
    "p[style-name='Heading 3'] => h3",
    "p[style-name='elenco10'] => ul > li",
    "p[style-name='List Paragraph'] => ul > li",
    "p[style-name='Paragrafo elenco1'] => ul > li",
    "p[style-name='Elenco puntato'] => ul > li",
    "p[style-name='toc 1'] => p.skip",
    "p[style-name='toc 2'] => p.skip",
    "p[style-name='toc 3'] => p.skip",
    "p[style-name='Plain Text'] => p.skip",
  ];
}

// ─── Stato chunk ──────────────────────────────────────────────────────────────

interface ChunkState {
  section: string;
  article: string;
  heading: string;
  chunkId: string;
  lines: string[];
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

function stateTokens(s: ChunkState): number {
  return countTokens(s.lines.join("\n"));
}

// ─── Contesto parser ──────────────────────────────────────────────────────────

interface ParserContext {
  prefix: string;
  counter: number;
  currentSection: string;
  currentH2text: string;      // testo dell'H2 corrente
  currentH2chunkId: string;   // chunk_id dell'H2 corrente
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
    ctx.lastChunk.text += "\n\n" + text;
    ctx.lastChunk.tokens = countTokens(ctx.lastChunk.text);
    if (state.article && !ctx.lastChunk.article.includes(state.article)) {
      ctx.lastChunk.article += " / " + state.article;
    }
    return;
  }

  ctx.counter++;
  const id = slugify(state.chunkId || makeChunkId(ctx.prefix, ctx.counter, state.heading));
  ctx.chunks.push({ id, section: state.section, article: state.article || state.heading, heading: state.heading, text, tokens });
  ctx.lastChunk = ctx.chunks[ctx.chunks.length - 1];
}

function checkOverflow(ctx: ParserContext): void {
  if (!ctx.building || stateTokens(ctx.building) <= TOKEN_MAX) return;
  const mid = Math.floor(ctx.building.lines.length / 2) || 1;
  const overflowLines = ctx.building.lines.splice(mid);
  flushChunk(ctx.building, ctx, false);
  const continuaHeading = `${ctx.building.heading} (continua)`;
  ctx.counter++;
  ctx.building = {
    section: ctx.currentSection,
    article: ctx.building.article,
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
    }
    ctx.glossaryTerm = trimmed.slice(0, colonIdx).trim();
    ctx.glossaryLines = [trimmed.slice(colonIdx + 1).trim()];
  } else {
    if (!ctx.glossaryTerm) { ctx.glossaryTerm = trimmed; ctx.glossaryLines = []; }
    else ctx.glossaryLines.push(trimmed);
  }

  const groupText = ctx.glossaryGroup.map((g) => `**${g.term}:** ${g.lines.join(" ")}`).join("\n\n");
  if (countTokens(groupText) >= TOKEN_MAX) flushGlossaryGroup(ctx);
}

function flushGlossaryGroup(ctx: ParserContext): void {
  if (ctx.glossaryGroup.length === 0) return;
  const first = ctx.glossaryGroup[0].term;
  const last  = ctx.glossaryGroup[ctx.glossaryGroup.length - 1].term;
  const heading = ctx.glossaryGroup.length === 1
    ? `Glossario — ${first}`
    : `Glossario — ${first} / ${last}`;
  const bodyLines = ctx.glossaryGroup.map((g) => `**${g.term}:** ${g.lines.join(" ").trim()}`);
  const text = [heading, ...bodyLines].join("\n\n");
  ctx.counter++;
  ctx.chunks.push({
    id: slugify(`${ctx.prefix}-gloss-${ctx.counter}`),
    section: "GLOSSARIO",
    article: `Definizioni: ${first}–${last}`,
    heading, text,
    tokens: countTokens(text),
  });
  ctx.lastChunk = ctx.chunks[ctx.chunks.length - 1];
  ctx.glossaryGroup = [];
}

function flushGlossary(ctx: ParserContext): void {
  if (ctx.glossaryTerm) {
    ctx.glossaryGroup.push({ term: ctx.glossaryTerm, lines: [...ctx.glossaryLines] });
    ctx.glossaryTerm = ""; ctx.glossaryLines = [];
  }
  if (ctx.glossaryGroup.length > 0) flushGlossaryGroup(ctx);
}

// ─── Markdown inline da paragrafo ────────────────────────────────────────────

function paragraphToMarkdown(node: HTMLElement): string {
  const parts: string[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const t = child.text.replace(/\s+/g, " ");
      if (t.trim()) parts.push(t);
    } else if (child.nodeType === NodeType.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase() ?? "";
      if (tag === "strong" || tag === "b") parts.push(`**${el.text.trim()}**`);
      else if (tag === "em" || tag === "i") parts.push(`_${el.text.trim()}_`);
      else parts.push(el.text.replace(/\s+/g, " ").trim());
    }
  });
  return parts.join("").trim();
}

function getTextContent(node: HTMLElement): string {
  return node.text.replace(/\s+/g, " ").trim();
}

// ─── Processore nodi ──────────────────────────────────────────────────────────

function processNode(node: HTMLElement, ctx: ParserContext): void {
  const tag = node.tagName?.toLowerCase() ?? "";
  if (node.classList?.contains("skip")) return;

  switch (tag) {

    case "h1": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      // Flush chunk corrente senza merge (H1 è boundary forte)
      if (ctx.building) { flushChunk(ctx.building, ctx, false); ctx.building = null; }
      ctx.currentSection = getTextContent(node);
      ctx.currentH2text = "";
      ctx.currentH2chunkId = "";
      break;
    }

    case "h2": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }
      // Flush chunk corrente
      if (ctx.building) { flushChunk(ctx.building, ctx, true); ctx.building = null; }
      const h2text = getTextContent(node);
      ctx.currentH2text = h2text;
      ctx.counter++;
      ctx.currentH2chunkId = makeChunkId(ctx.prefix, ctx.counter, h2text);
      // Apri nuovo chunk per questo H2
      ctx.building = newChunkState(ctx.currentSection, h2text, h2text, ctx.currentH2chunkId);
      break;
    }

    case "h3": {
      if (ctx.inPrologue) { flushGlossary(ctx); ctx.inPrologue = false; }

      const h3text = getTextContent(node);
      const heading = ctx.currentH2text ? `${ctx.currentH2text} > ${h3text}` : h3text;

      if (!ctx.building) {
        // Nessun chunk aperto: crea uno nuovo
        ctx.counter++;
        ctx.building = newChunkState(
          ctx.currentSection, h3text, heading,
          makeChunkId(ctx.prefix, ctx.counter, h3text)
        );
      } else if (stateTokens(ctx.building) >= TOKEN_MAX) {
        // Chunk già pieno: flush e apri nuovo
        flushChunk(ctx.building, ctx, false);
        ctx.counter++;
        ctx.building = newChunkState(
          ctx.currentSection, h3text, heading,
          makeChunkId(ctx.prefix, ctx.counter, h3text)
        );
      } else {
        // ── LOGICA CHIAVE: accumula H3 nello stesso chunk ──
        // Aggiungi un separatore visivo e continua ad appendere
        appendLine(ctx.building, `\n## ${heading}`);
        // Aggiorna article per riflettere il nuovo sotto-argomento
        ctx.building.article = h3text;
      }
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
          ctx.currentSection, ctx.currentH2text,
          ctx.currentH2text || ctx.currentSection,
          ctx.currentH2chunkId || makeChunkId(ctx.prefix, ctx.counter, ctx.currentH2text)
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
          ctx.currentSection, ctx.currentH2text,
          ctx.currentH2text || ctx.currentSection || "Introduzione",
          ctx.currentH2chunkId || makeChunkId(ctx.prefix, ctx.counter, ctx.currentH2text || "intro")
        );
      }
      appendLine(ctx.building, mdText);
      checkOverflow(ctx);
      break;
    }

    default: {
      node.childNodes.forEach((child) => {
        if (child.nodeType === NodeType.ELEMENT_NODE) processNode(child as HTMLElement, ctx);
      });
    }
  }
}

// ─── Rilevamento titolo documento ─────────────────────────────────────────────

function detectDocumentTitle(html: string): string {
  const root = parse(html);
  const candidates = root.querySelectorAll("h1, p");
  for (const node of candidates) {
    const text = node.text.replace(/\s+/g, " ").trim();
    // Skip testi troppo corti (brand, date) o troppo lunghi (paragrafi)
    // Skip anche testi che sembrano il brand "Allianz" da solo
    if (text.length >= 8 && text.length <= 120 && !/^allianz\s*$/i.test(text)) return text;
  }
  return "Documento";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT DOCX
// ═══════════════════════════════════════════════════════════════════════════════

export async function chunkDocxBuffer(buffer: Buffer): Promise<Chunk[]> {
  // Passata 1: titolo per derivare prefisso
  const { value: htmlMin } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: ["p[style-name='toc 1'] => p.skip", "p[style-name='toc 2'] => p.skip"] }
  );
  const prefix = derivePrefix(detectDocumentTitle(htmlMin));

  // Passata 2: conversione completa
  const { value: html } = await mammoth.convertToHtml({ buffer }, { styleMap: buildStyleMap() });

  const root = parse(html);
  const ctx: ParserContext = {
    prefix, counter: 0,
    currentSection: "", currentH2text: "", currentH2chunkId: "",
    building: null, chunks: [], lastChunk: null,
    inPrologue: true,
    glossaryGroup: [], glossaryTerm: "", glossaryLines: [],
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === NodeType.ELEMENT_NODE) processNode(node as HTMLElement, ctx);
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
    const m = line.match(/\*\*chunk_id:\*\*\s*(.+)/); if (m) chunkId = m[1].trim();
    const s = line.match(/\*\*sezione:\*\*\s*(.+)/);  if (s) sezione = s[1].trim();
    const t = line.match(/\*\*topic:\*\*\s*(.+)/);    if (t) topic   = t[1].trim();
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
      lastChunk.text += "\n\n" + content; lastChunk.tokens = countTokens(lastChunk.text); return;
    }
    const chunk: Chunk = {
      id: slugify(currentHeading || currentSection || "sezione"),
      section: currentSection, article: currentArticle, heading: currentHeading,
      text: content, tokens,
    };
    chunks.push(chunk); lastChunk = chunk; buffer = [];
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
