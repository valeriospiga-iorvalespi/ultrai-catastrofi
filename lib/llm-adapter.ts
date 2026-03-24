/**
 * lib/llm-adapter.ts
 * Unified LLM caller — abstracts Anthropic / OpenAI / Mistral / Google.
 *
 * Install deps (if not already present):
 *   npm install openai @mistralai/mistralai @google/generative-ai
 */

export type LLMProvider = 'anthropic' | 'openai' | 'mistral' | 'google';

export interface LLMCallParams {
  provider: LLMProvider;
  model: string;
  /** Decrypted API key. If null/undefined, falls back to env var for that provider. */
  apiKey: string | null | undefined;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  /** Optional: prepend conversation history (role/content pairs) */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(p: LLMCallParams): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: p.apiKey ?? process.env.ANTHROPIC_API_KEY });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(p.history ?? []),
    { role: 'user', content: p.userPrompt },
  ];

  const response = await client.messages.create({
    model: p.model,
    max_tokens: p.maxTokens,
    system: p.systemPrompt,
    messages,
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Anthropic: unexpected response type');
  return block.text;
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(p: LLMCallParams): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: p.apiKey ?? process.env.OPENAI_API_KEY });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: p.systemPrompt },
    ...(p.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: p.userPrompt },
  ];

  const response = await client.chat.completions.create({
    model: p.model,
    max_tokens: p.maxTokens,
    messages,
  });

  return response.choices[0]?.message?.content ?? '';
}

// ─── Mistral ─────────────────────────────────────────────────────────────────

async function callMistral(p: LLMCallParams): Promise<string> {
  const { Mistral } = await import('@mistralai/mistralai');
  const client = new Mistral({ apiKey: p.apiKey ?? process.env.MISTRAL_API_KEY });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: p.systemPrompt },
    ...(p.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: p.userPrompt },
  ];

  const response = await client.chat.complete({
    model: p.model,
    maxTokens: p.maxTokens,
    messages,
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }
  return '';
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function callGoogle(p: LLMCallParams): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(p.apiKey ?? process.env.GOOGLE_API_KEY ?? '');
  const genModel = client.getGenerativeModel({ model: p.model });

  // Build chat history for Gemini (system prompt prepended to first user turn)
  const historyParts = (p.history ?? []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = genModel.startChat({
    history: historyParts,
    systemInstruction: p.systemPrompt,
    generationConfig: { maxOutputTokens: p.maxTokens },
  });

  const result = await chat.sendMessage(p.userPrompt);
  return result.response.text();
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function callLLM(params: LLMCallParams): Promise<LLMResponse> {
  let text: string;

  switch (params.provider) {
    case 'anthropic':
      text = await callAnthropic(params);
      break;
    case 'openai':
      text = await callOpenAI(params);
      break;
    case 'mistral':
      text = await callMistral(params);
      break;
    case 'google':
      text = await callGoogle(params);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${params.provider}`);
  }

  return { text, provider: params.provider, model: params.model };
}

// ─── Model lists per provider (aggiornati marzo 2026) ────────────────────────

export const PROVIDER_MODELS: Record<LLMProvider, { id: string; label: string }[]> = {
  anthropic: [
    // Claude 4.6 (latest)
    { id: 'claude-opus-4-6',              label: 'Claude Opus 4.6 ✦' },
    { id: 'claude-sonnet-4-6',            label: 'Claude Sonnet 4.6' },
    // Claude 4.5
    { id: 'claude-opus-4-5-20251101',     label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5-20251022',   label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5' },
    // Claude 4
    { id: 'claude-opus-4-1',              label: 'Claude Opus 4.1' },
    { id: 'claude-sonnet-4-20250514',     label: 'Claude Sonnet 4' },
    // Claude 3.7 / 3.5
    { id: 'claude-3-7-sonnet-20250219',   label: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022',   label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022',    label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    // GPT-5 family (2026)
    { id: 'gpt-5.4',        label: 'GPT-5.4 ✦' },
    { id: 'gpt-5.4-mini',   label: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano',   label: 'GPT-5.4 Nano' },
    { id: 'gpt-5.2',        label: 'GPT-5.2' },
    // GPT-4.1 family
    { id: 'gpt-4.1',        label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini',   label: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano',   label: 'GPT-4.1 Nano' },
    // GPT-4o family
    { id: 'gpt-4o',         label: 'GPT-4o' },
    { id: 'gpt-4o-mini',    label: 'GPT-4o Mini' },
    // Reasoning
    { id: 'o1',             label: 'o1' },
    { id: 'o3',             label: 'o3' },
    { id: 'o3-mini',        label: 'o3 Mini' },
    { id: 'o4-mini',        label: 'o4 Mini' },
  ],
  mistral: [
    // Frontier / reasoning
    { id: 'mistral-large-latest',       label: 'Mistral Large 3 ✦' },
    { id: 'magistral-medium-latest',    label: 'Magistral Medium' },
    { id: 'magistral-small-latest',     label: 'Magistral Small' },
    // General purpose
    { id: 'mistral-medium-latest',      label: 'Mistral Medium 3' },
    { id: 'mistral-small-latest',       label: 'Mistral Small 3.1' },
    { id: 'ministral-8b-latest',        label: 'Ministral 8B' },
    { id: 'ministral-3b-latest',        label: 'Ministral 3B' },
    // Code
    { id: 'codestral-latest',           label: 'Codestral 2' },
    { id: 'devstral-small-latest',      label: 'Devstral Small' },
  ],
  google: [
    // Gemini 3.1 (latest, feb-mar 2026)
    { id: 'gemini-3.1-pro-preview',      label: 'Gemini 3.1 Pro ✦' },
    { id: 'gemini-3.1-flash-preview',    label: 'Gemini 3.1 Flash' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' },
    // Gemini 3.0
    { id: 'gemini-3-flash-preview',      label: 'Gemini 3 Flash' },
    // Gemini 2.5
    { id: 'gemini-2.5-pro',              label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite',       label: 'Gemini 2.5 Flash Lite' },
    // Gemini 2.0 (deprecazione giugno 2026)
    { id: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash (dep. giu 2026)' },
  ],
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  mistral:   'Mistral',
  google:    'Google',
};
