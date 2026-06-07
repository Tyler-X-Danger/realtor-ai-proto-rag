import { useState, useRef, useEffect } from 'react'

const SEED_MESSAGES = [
  { role: 'assistant', text: 'Hello! I\'m the AmpAI Assistant, trained on the Realtor.com Platform AI Playbook. Ask me about LLM gateway rules, MLS schema mappings, or UAT compliance guardrails.' },
  { role: 'user', text: 'What model does the gateway use for semantic caching?' },
  { role: 'assistant', text: 'The LLM Gateway uses a similarity threshold of 0.92 for semantic caching on Tier-1 models (Claude 3.5 Sonnet, GPT-4o). Cache keys are hashed from the model ID, system prompt SHA256, and the semantic embedding of the user message. Lowering below 0.85 requires a formal waiver.' },
]

const DEMO_RESPONSES = [
  {
    patterns: ['token', 'budget', 'cap', 'spend', 'limit', 'daily', 'sonnet', 'claude', 'exceed'],
    reply: 'The daily token budget cap for Claude 3.5 Sonnet is $50.00 per team. When exceeded, all requests are automatically routed to the configured fallback model (GPT-4o-mini at $0.60/1M tokens). A PagerDuty alert fires at 80% of daily spend. Teams can request a temporary cap increase via the LLM Gateway admin panel with a business justification approved by the AI Platform lead.',
  },
  {
    patterns: ['bth_tot', 'mls', 'bathroom', 'schema', 'mapping', 'canonical', 'l_proptypekind', 'sq_feet', 'lst_price', 'field'],
    reply: 'The MLS column `Bth_Tot` maps to the canonical Realtor.com field `total_bathrooms` (integer). Full common mappings: `L_PropTypeKind` → `property_type`, `Bth_Tot` → `total_bathrooms`, `Sq_Feet` → `square_footage`, `Lst_Price` → `list_price`, `Lp_SqFt` → `price_per_sqft`. All MLS ingestion pipelines run through the RESO v2.0 normalization layer before writing to the canonical schema.',
  },
  {
    patterns: ['accessibility', 'lighthouse', 'wcag', 'axe', 'playwright', 'uat', 'compliance', 'score', 'audit', 'testing', 'pipeline'],
    reply: 'The UAT pipeline runs three tools: Playwright for end-to-end flow testing, axe-core for WCAG 2.1 AA automated audits (any violation is a blocking gate), and Google Lighthouse for performance + accessibility scoring. Lighthouse must score ≥92/100 to pass the deployment gate. Reports are uploaded to the AmpAI compliance dashboard and retained for 90 days.',
  },
  {
    patterns: ['cache', 'semantic', 'caching', 'threshold', 'similarity', '0.92', 'waiver'],
    reply: 'The LLM Gateway enforces a semantic cache similarity threshold of 0.92 for Tier-1 models. Cache keys are derived from: model ID, SHA-256 of the system prompt, and the semantic embedding of the user message. Dropping the threshold below 0.85 requires a formal architecture waiver signed off by the AI Platform lead (priya-v@realtor.com).',
  },
  {
    patterns: ['gateway', 'portkey', 'route', 'register', 'api', 'endpoint', 'tier', 'path'],
    reply: 'All AI API traffic routes through the Portkey LLM Gateway at `gateway.internal.realtor.com`. To register a new endpoint: add your service in the Gateway admin panel with model name, team slug, rate-limit tier, and PII handling policy. Tier-1 models (Claude 3.5 Sonnet, GPT-4o) require platform approval. Tier-2 models (GPT-4o-mini, Gemini Flash) are self-serve.',
  },
  {
    patterns: ['pii', 'scrub', 'scrubbing', 'personal', 'privacy', 'redact', 'data'],
    reply: 'PII scrubbing is mandatory for all prompts sent through the LLM Gateway. The gateway auto-detects and redacts SSNs, email addresses, phone numbers, and full names via a Presidio-based detection layer. Raw PII in a prompt triggers a 400 error with a remediation guide. Teams must implement client-side scrubbing before sending requests to the gateway.',
  },
  {
    patterns: ['team', 'contact', 'who', 'owner', 'lead', 'priya', 'darius', 'marco', 'soojin', 'oncall'],
    reply: 'AI Platform team contacts — Platform Lead: Priya Venkataraman (priya-v@realtor.com), MLS Data Engineering: Darius Okeke (d-okeke@realtor.com), UAT & Compliance: Soo-Jin Park (soojin@realtor.com), Gateway Operations: Marco Delgado (m-delgado@realtor.com). For urgent issues, page @ampai-oncall in Slack.',
  },
  {
    patterns: ['model', 'gpt', 'gemini', 'approved', 'allowed', 'use', 'which'],
    reply: 'Approved models in the AmpAI Gateway: Tier-1 (requires approval) — Claude 3.5 Sonnet, GPT-4o. Tier-2 (self-serve) — GPT-4o-mini, Gemini 1.5 Flash, Claude 3 Haiku. All model usage is logged and attributed to your team slug for budget tracking. Unapproved model calls are blocked at the gateway with a 403.',
  },
  {
    patterns: ['vendor', 'claude sonnet', 'sonnet 4', 'token price', 'prompt caching', 'portkey routing', 'routing logic', 'traffic cop', 'gemini flash', 'input cost'],
    reply: 'Vendor cost-routing matrix (2026): Claude Sonnet 4.6 — $3.00/M input, $15.00/M output, 1M context window. Prompt Caching cuts input to $0.30/M (90% savings) for repeated codebase scans — cache hit rates of 85–95% are typical for IDE workflows. Gemini 1.5 Pro — $1.25/M input, $5.00/M output; native multimodal, $4.50/M tokens/hr cache storage for MLS media batches. Gemini Flash — $0.075/M input for high-velocity autocomplete. Portkey routing logic: autocomplete + syntax checking → Gemini Flash; RAG Q&A + short codegen → GPT-4o-mini; git diff generation + architectural refactoring + complex test pipelines → Claude Sonnet 4.6 with prompt cache enabled.',
  },
  {
    patterns: ['revenue agent', 'marketing agent', 'hr agent', 'multi-agent', 'langgraph', 'llamaindex', 'blueprint', 'commission', 'fair housing', 'crm', 'compliance agent', 'business agent', 'enablement agent'],
    reply: 'Three multi-agent workflows are deployed for non-technical business units, built on LangGraph + LlamaIndex + Portkey:\n\n1. Client Revenue Agent (team: revenue-ops-agent): Ingests CRM data, sales interaction logs, and local MLS transaction history. Forecasts 30/60/90-day commission pipelines and generates risk-mitigation plays for agents with >20% MoM velocity drop-offs. Delivers daily to Revenue Ops Slack.\n\n2. Consumer Marketing Agent (team: consumer-mktg-agent): Transforms MLS listing metadata into cross-channel social ad creative (Facebook, Instagram, Google Display). Includes a BLOCKING compliance gate using Claude Sonnet 4.6 that validates all copy against the Fair Housing Act and HUD advertising guidance before any asset is published. Escalates to human review if a variant fails after one auto-regeneration pass.\n\n3. HR & Talent Enablement Agent (team: hr-enablement-agent): Real-time Q&A tool for staff queries on corporate policy handbooks, Texas leave-of-absence rules, and engineering interview rubrics (L3–L7 scorecards). Responds via Slack (@ampai-hr) with policy-grounded answers and source citations. Sensitive topics (termination, accommodations) are always escalated to People Ops.',
  },
]

const FALLBACK_REPLY = "I can answer questions about: LLM Gateway rules and token budget caps, MLS schema field mappings, UAT and accessibility compliance requirements, semantic caching configuration, PII scrubbing policies, approved models, AI Platform team contacts, vendor cost-routing matrix (Claude Sonnet 4.6 vs. Gemini vs. GPT-4o-mini pricing), and multi-agent blueprints (Revenue Agent, Consumer Marketing Agent, HR Enablement Agent). Try one of those topics!"

function getDemoReply(message) {
  const lower = message.toLowerCase()
  for (const { patterns, reply } of DEMO_RESPONSES) {
    if (patterns.some((p) => lower.includes(p))) return reply
  }
  return FALLBACK_REPLY
}

function Dots() {
  return (
    <span className="inline-flex items-end gap-0.5 h-4">
      <span className="dot-1 w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span className="dot-2 w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span className="dot-3 w-1.5 h-1.5 rounded-full bg-slate-400" />
    </span>
  )
}

export default function AIChatCard() {
  const [messages, setMessages] = useState(SEED_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: getDemoReply(text) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col" style={{ minHeight: '420px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-indigo-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">AmpAI Assistant</h2>
          <p className="text-xs text-slate-500">RAG · platform_ai_playbook.md</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          gpt-4o-mini
        </span>
      </div>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto chat-scroll space-y-3 pr-1 mb-4" style={{ maxHeight: '280px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-700 text-slate-200 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-xl rounded-bl-sm px-3.5 py-2.5">
              <Dots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2 mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about gateway rules, MLS mappings, UAT compliance…"
          disabled={loading}
          className="flex-1 rounded-lg bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
