'use client';

/**
 * components/admin/ConfigTab.tsx
 * Tab Configurazione in AdminShell — gestisce persona/domain/guardrails/language
 * + selezione provider/modello per Retriever e Orchestrator con API key cifrata.
 */

import { useState, useEffect, useCallback } from 'react';
import { PROVIDER_MODELS, PROVIDER_LABELS, LLMProvider } from '@/lib/llm-adapter';

interface ProductConfig {
  id: string;
  name: string;
  persona: string;
  domain: string;
  guardrails: string;
  language: string;
  retriever_provider: LLMProvider;
  retriever_model: string;
  retriever_key_saved: boolean;
  orchestrator_provider: LLMProvider;
  orchestrator_model: string;
  orchestrator_key_saved: boolean;
}

interface ConfigTabProps {
  productId: string;
}

const PROVIDERS = Object.keys(PROVIDER_MODELS) as LLMProvider[];

// ─── Sub-component: AgentConfig ───────────────────────────────────────────────

interface AgentConfigProps {
  label: string;
  role: 'retriever' | 'orchestrator';
  provider: LLMProvider;
  model: string;
  keySaved: boolean;
  onProviderChange: (v: LLMProvider) => void;
  onModelChange:    (v: string) => void;
  onKeyChange:      (v: string) => void;
}

function AgentConfig({
  label, role, provider, model, keySaved,
  onProviderChange, onModelChange, onKeyChange,
}: AgentConfigProps) {
  const models = PROVIDER_MODELS[provider] ?? [];
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey]   = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {keySaved && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            🔑 Key salvata
          </span>
        )}
      </div>

      {/* Provider */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Provider</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={provider}
          onChange={(e) => {
            const p = e.target.value as LLMProvider;
            onProviderChange(p);
            // Reset model to first of new provider
            onModelChange(PROVIDER_MODELS[p]?.[0]?.id ?? '');
          }}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Modello</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          API Key {keySaved ? '(lascia vuoto per non sovrascrivere)' : '(richiesta)'}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            placeholder={keySaved ? '••••••••••••••••' : `Inserisci API key ${PROVIDER_LABELS[provider]}`}
            value={keyValue}
            onChange={(e) => {
              setKeyValue(e.target.value);
              onKeyChange(e.target.value);
            }}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        {/* Anthropic default note */}
        {provider === 'anthropic' && !keySaved && (
          <p className="text-xs text-gray-400 mt-1">
            Se vuoto, usa la <code>ANTHROPIC_API_KEY</code> di env Vercel.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main ConfigTab ───────────────────────────────────────────────────────────

export default function ConfigTab({ productId }: ConfigTabProps) {
  const [config, setConfig]     = useState<ProductConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // LLM state (local, pending save)
  const [retrieverProvider,    setRetrieverProvider]    = useState<LLMProvider>('anthropic');
  const [retrieverModel,       setRetrieverModel]       = useState('claude-sonnet-4-5-20251022');
  const [retrieverKey,         setRetrieverKey]         = useState('');
  const [orchestratorProvider, setOrchestratorProvider] = useState<LLMProvider>('anthropic');
  const [orchestratorModel,    setOrchestratorModel]    = useState('claude-haiku-4-5-20251001');
  const [orchestratorKey,      setOrchestratorKey]      = useState('');

  // Text fields
  const [persona,    setPersona]    = useState('');
  const [domain,     setDomain]     = useState('');
  const [guardrails, setGuardrails] = useState('');
  const [language,   setLanguage]   = useState('italiano');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/config?productId=${productId}`);
      if (!res.ok) throw new Error('Errore caricamento config');
      const data: ProductConfig = await res.json();
      setConfig(data);
      setPersona(data.persona ?? '');
      setDomain(data.domain ?? '');
      setGuardrails(data.guardrails ?? '');
      setLanguage(data.language ?? 'italiano');
      setRetrieverProvider(data.retriever_provider ?? 'anthropic');
      setRetrieverModel(data.retriever_model ?? 'claude-sonnet-4-5-20251022');
      setOrchestratorProvider(data.orchestrator_provider ?? 'anthropic');
      setOrchestratorModel(data.orchestrator_model ?? 'claude-haiku-4-5-20251001');
    } catch (e) {
      setError('Impossibile caricare la configurazione.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          persona, domain, guardrails, language,
          retriever_provider:    retrieverProvider,
          retriever_model:       retrieverModel,
          retriever_api_key:     retrieverKey,
          orchestrator_provider: orchestratorProvider,
          orchestrator_model:    orchestratorModel,
          orchestrator_api_key:  orchestratorKey,
        }),
      });
      if (!res.ok) throw new Error('Errore salvataggio');
      setSaved(true);
      // Reload to update key_saved flags
      await loadConfig();
      // Clear key inputs after save
      setRetrieverKey('');
      setOrchestratorKey('');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Salvataggio fallito. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
      Caricamento configurazione…
    </div>
  );

  if (!config) return (
    <div className="text-red-500 text-sm p-4">{error || 'Prodotto non trovato.'}</div>
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Sezione LLM ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🤖 Modelli LLM</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AgentConfig
            label="Retriever"
            role="retriever"
            provider={retrieverProvider}
            model={retrieverModel}
            keySaved={config.retriever_key_saved}
            onProviderChange={setRetrieverProvider}
            onModelChange={setRetrieverModel}
            onKeyChange={setRetrieverKey}
          />
          <AgentConfig
            label="Orchestrator"
            role="orchestrator"
            provider={orchestratorProvider}
            model={orchestratorModel}
            keySaved={config.orchestrator_key_saved}
            onProviderChange={setOrchestratorProvider}
            onModelChange={setOrchestratorModel}
            onKeyChange={setOrchestratorKey}
          />
        </div>

        {/* Riepilogo modelli attivi */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          <span>Attivo:</span>
          <ModelBadge role="R" provider={retrieverProvider}    model={retrieverModel} />
          <span>·</span>
          <ModelBadge role="O" provider={orchestratorProvider} model={orchestratorModel} />
        </div>
      </div>

      {/* ── Sezione Personalità ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🎭 Personalità e dominio</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Persona</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Sei un assistente specializzato in…"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dominio</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Guardrails</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              value={guardrails}
              onChange={(e) => setGuardrails(e.target.value)}
              placeholder="Non rispondere a domande al di fuori di…"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Lingua</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="italiano">Italiano</option>
              <option value="english">English</option>
              <option value="español">Español</option>
              <option value="français">Français</option>
              <option value="deutsch">Deutsch</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-red-500 text-xs">{error}</p>
      )}
      {saved && (
        <p className="text-green-600 text-xs">✅ Configurazione salvata.</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#e30613] text-white text-sm font-medium px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Salvataggio…' : 'Salva configurazione'}
      </button>
    </div>
  );
}

// ─── Badge modello attivo ─────────────────────────────────────────────────────

function ModelBadge({ role, provider, model }: { role: string; provider: LLMProvider; model: string }) {
  const modelLabel = PROVIDER_MODELS[provider]?.find((m) => m.id === model)?.label ?? model;
  const providerLabel = PROVIDER_LABELS[provider];
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
      <span className="font-semibold text-gray-700">{role}:</span>
      {providerLabel} · {modelLabel}
    </span>
  );
}
