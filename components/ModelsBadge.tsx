'use client';

/**
 * components/ModelsBadge.tsx
 * Mostra provider+modello attivi per Retriever e Orchestrator.
 * Visibile solo all'admin.
 * Usato in: ChatArea header (variant="header") e footer (variant="footer")
 */

import { PROVIDER_LABELS, PROVIDER_MODELS, LLMProvider } from '@/lib/llm-adapter';

interface ModelsInfo {
  retriever:    { provider: LLMProvider; model: string };
  orchestrator: { provider: LLMProvider; model: string };
}

interface ModelsBadgeProps {
  models: ModelsInfo;
  variant?: 'header' | 'footer';
}

function shortLabel(provider: LLMProvider, modelId: string): string {
  const found = PROVIDER_MODELS[provider]?.find((m) => m.id === modelId);
  // Abbrevia: "Claude Sonnet 4.5" → "Sonnet 4.5", "GPT-4o Mini" → "GPT-4o Mini"
  const label = found?.label ?? modelId;
  return label.replace(/^Claude\s+/, '').replace(/^Gemini\s+/, 'Gemini ');
}

export default function ModelsBadge({ models, variant = 'header' }: ModelsBadgeProps) {
  const rProvider = models.retriever.provider as LLMProvider;
  const oProvider = models.orchestrator.provider as LLMProvider;

  const rLabel = `${PROVIDER_LABELS[rProvider]} · ${shortLabel(rProvider, models.retriever.model)}`;
  const oLabel = `${PROVIDER_LABELS[oProvider]} · ${shortLabel(oProvider, models.orchestrator.model)}`;

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono">
        <span title="Retriever" className="flex items-center gap-1">
          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">R</span>
          {rLabel}
        </span>
        <span className="text-gray-300">·</span>
        <span title="Orchestrator" className="flex items-center gap-1">
          <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">O</span>
          {oLabel}
        </span>
      </div>
    );
  }

  // footer variant
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 font-mono px-4 py-2 border-t border-gray-100 bg-gray-50">
      <span className="text-gray-300">🤖</span>
      <span title="Retriever">
        <span className="font-semibold text-gray-500">R:</span> {rLabel}
      </span>
      <span className="text-gray-300">·</span>
      <span title="Orchestrator">
        <span className="font-semibold text-gray-500">O:</span> {oLabel}
      </span>
    </div>
  );
}
