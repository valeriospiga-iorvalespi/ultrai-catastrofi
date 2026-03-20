/**
 * lib/chunker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Elabora un .docx del normativo assicurativo e produce chunk semanticamente
 * coerenti per il retrieval RAG.
 *
 * Dipendenze:  mammoth  node-html-parser
 * Next.js 14 / TypeScript
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mammoth from "mammoth";
import { parse, HTMLElement, Node, NodeType } from "node-html-parser";

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

// ─── Stato di build del chunk ────────────────────────────────────────────────

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

  // Troppo corto → unisci al chunk precedente
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

// ─── Stato globale del parser ────────────────────────────────────────────────

interface ParserContext {
  currentSection: string;
  currentArticle: string;
  currentH2: string;
  /** Chunk in costruzione */
  building: ChunkState | null;
  chunks: Chunk[];
  lastChunk: Chunk | null;
  /** Siamo ancora nel prologo (prima del primo H1)? */
  inPrologue: boolean;
  /** Stato per il glossario */
  glossaryLines: string[];
  inGlossaryTerm: boolean;
  glossaryTerm: string;
}

function newState(
  section: string,
  article: string,
  heading: string
): ChunkState {
  return { section, article, heading, lines: [heading] };
}

function appendText(state: ChunkState, text: string): void {
  const line = text.trim();
  if (line) state.lines.push(line);
}

// ─── Gestione prologo / glossario ────────────────────────────────────────────

/**
 * I paragrafi prima del primo H1 sono trattati come definizioni di glossario.
 * Ogni definizione occupa un chunk a sé.
 * Euristica: la prima riga di testo in un paragrafo è il termine,
 * le successive sono la definizione.
 */
function processGlossaryParagraph(ctx: ParserContext, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Se il testo contiene ":" nella prima parte, trattalo come "termine: def"
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0 && colonIdx < 80) {
    // Flush eventuale termine pendente
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
      // Primo paragrafo senza ":" → consideriamolo termine
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

// ─── Split per overflow (>400 token) ────────────────────────────────────────

/**
 * Se il chunk in costruzione supera TOKEN_MAX, fa flush e apre un nuovo
 * stato con heading " (continua)" per il contenuto rimanente.
 */
function checkOverflow(ctx: ParserContext): void {
  if (!ctx.building) return;
  if (stateTokens(ctx.building) <= TOKEN_MAX) return;

  // Flush quello che c'è
  const continuaHeading = `${ctx.building.heading} (continua)`;
  const overflowLines: string[] = [];

  // Porta avanti le ultime righe che causano overflow
  // Strategia: dimezza le righe tenendo le prime nel chunk flushed
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

// ─── Gestione nodi HTML ──────────────────────────────────────────────────────

function getTextContent(node: HTMLElement): string {
  return node.text.replace(/\s+/g, " ").trim();
}

function processNode(node: HTMLElement, ctx: ParserContext): void {
  const tag = node.tagName?.toLowerCase() ?? "";

  // Ignora stili marcati .skip
  if (node.classList?.contains("skip")) return;

  switch (tag) {
    case "h1": {
      // Fine prologo
      if (ctx.inPrologue) {
        flushGlossary(ctx);
        ctx.inPrologue = false;
      }
      // Flush chunk corrente
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
        ctx.building = null;
      }
      ctx.currentSection = getTextContent(node);
      ctx.currentArticle = "";
      ctx.currentH2 = "";
      // H1 non genera chunk autonomo
      break;
    }

    case "h2": {
      if (ctx.inPrologue) {
        flushGlossary(ctx);
        ctx.inPrologue = false;
      }
      // Flush chunk corrente
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
      }
      ctx.currentArticle = getTextContent(node);
      ctx.currentH2 = ctx.currentArticle;
      ctx.building = newState(
        ctx.currentSection,
        ctx.currentArticle,
        ctx.currentArticle
      );
      break;
    }

    case "h3": {
      if (ctx.inPrologue) {
        flushGlossary(ctx);
        ctx.inPrologue = false;
      }
      // Flush chunk corrente
      if (ctx.building) {
        ctx.lastChunk = flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
      }
      const h3text = getTextContent(node);
      // Heading prefissato: "H2 > H3" per contesto
      const heading = ctx.currentH2
        ? `${ctx.currentH2} > ${h3text}`
        : h3text;
      ctx.building = newState(
        ctx.currentSection,
        ctx.currentArticle,
        heading
      );
      break;
    }

    case "ul": {
      // Elenco: ogni <li> aggregato nel chunk corrente
      if (ctx.inPrologue) {
        // Tratta i li come testo di glossario
        node.querySelectorAll("li").forEach((li) => {
          processGlossaryParagraph(ctx, getTextContent(li as HTMLElement));
        });
        return;
      }
      if (!ctx.building) {
        // Apri chunk implicito con heading dalla sezione corrente
        ctx.building = newState(
          ctx.currentSection,
          ctx.currentArticle,
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

      if (ctx.inPrologue) {
        processGlossaryParagraph(ctx, text);
        return;
      }

      if (!ctx.building) {
        // Testo prima di qualsiasi heading: apri chunk implicito
        ctx.building = newState(
          ctx.currentSection,
          ctx.currentArticle,
          ctx.currentArticle || ctx.currentSection || "Introduzione"
        );
      }
      appendText(ctx.building, text);
      checkOverflow(ctx);
      break;
    }

    default: {
      // Processa i figli ricorsivamente
      node.childNodes.forEach((child) => {
        if (child.nodeType === NodeType.ELEMENT_NODE) {
          processNode(child as HTMLElement, ctx);
        }
      });
    }
  }
}

// ─── Entry point principale ──────────────────────────────────────────────────

/**
 * Converte un buffer .docx in chunk RAG semanticamente coerenti.
 *
 * @param buffer  Contenuto binario del file .docx
 * @returns       Array di Chunk ordinati come nel documento
 */
export async function chunkDocxBuffer(buffer: Buffer): Promise<Chunk[]> {
  // 1. Converti .docx → HTML con mammoth
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Titolo1'] => h1",
        "p[style-name='Titolo2'] => h2",
        "p[style-name='Titolo3'] => h3",
        "p[style-name='elenco10'] => ul > li",
        "p[style-name='ListParagraph'] => ul > li",
        "p[style-name='Paragrafoelenco10'] => ul > li",
        "p[style-name='Paragrafoelenco1'] => ul > li",
        "p[style-name='TOC1'] => p.skip",
        "p[style-name='TOC2'] => p.skip",
        "p[style-name='PlainText'] => p.skip",
      ],
    }
  );

  // 2. Parsa l'HTML
  const root = parse(html);

  // 3. Costruisci i chunk
  const ctx: ParserContext = {
    currentSection: "",
    currentArticle: "",
    currentH2: "",
    building: null,
    chunks: [],
    lastChunk: null,
    inPrologue: true,
    glossaryLines: [],
    inGlossaryTerm: false,
    glossaryTerm: "",
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      processNode(node as HTMLElement, ctx);
    }
  });

  // 4. Flush finale
  if (ctx.inPrologue) flushGlossary(ctx);
  if (ctx.building) {
    flushChunk(ctx.building, ctx.chunks, ctx.lastChunk, true);
  }

  // 5. Post-processing: deduplicazione slug
  const slugCount: Record<string, number> = {};
  ctx.chunks.forEach((chunk) => {
    slugCount[chunk.id] = (slugCount[chunk.id] ?? 0) + 1;
  });
  const slugSeen: Record<string, number> = {};
  ctx.chunks.forEach((chunk) => {
    if (slugCount[chunk.id] > 1) {
      slugSeen[chunk.id] = (slugSeen[chunk.id] ?? 0) + 1;
      chunk.id = `${chunk.id}-${slugSeen[chunk.id]}`;
    }
  });

  return ctx.chunks;
}
