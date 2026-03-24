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

// ─── Model lists per provider (usate nell'UI) ─────────────────────────────────

export const PROVIDER_MODELS: Record<LLMProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20251022', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5' },
  ],
  openai: [
    { id: 'gpt-4o',       label: 'GPT-4o' },
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo' },
    { id: 'o1-mini',      label: 'o1 Mini' },
  ],
  mistral: [
    { id: 'mistral-large-latest',  label: 'Mistral Large' },
    { id: 'mistral-small-latest',  label: 'Mistral Small' },
    { id: 'open-mixtral-8x22b',    label: 'Mixtral 8×22B' },
    { id: 'codestral-latest',      label: 'Codestral' },
  ],
  google: [
    { id: 'gemini-2.0-flash',        label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite',   label: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-1.5-pro',          label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash',        label: 'Gemini 1.5 Flash' },
  ],
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  mistral:   'Mistral',
  google:    'Google',
};
