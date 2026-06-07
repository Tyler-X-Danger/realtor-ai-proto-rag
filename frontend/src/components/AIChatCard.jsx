import { useState, useRef, useEffect } from 'react'

const SEED_MESSAGES = [
  { role: 'assistant', text: 'Hello! I\'m the AmpAI Assistant, trained on the Realtor.com Platform AI Playbook. Ask me about LLM gateway rules, MLS schema mappings, or UAT compliance guardrails.' },
  { role: 'user', text: 'What model does the gateway use for semantic caching?' },
  { role: 'assistant', text: 'The LLM Gateway uses a similarity threshold of 0.92 for semantic caching on Tier-1 models (Claude 3.5 Sonnet, GPT-4o). Cache keys are hashed from the model ID, system prompt SHA256, and the semantic embedding of the user message. Lowering below 0.85 requires a formal waiver.' },
]

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
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
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
    } catch (err) {
      setError('Could not reach the RAG backend. Make sure server.py is running on port 8000.')
      setMessages((prev) => [...prev, { role: 'assistant', text: '⚠️ Backend unreachable — run `python3 server.py` first.' }])
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

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
