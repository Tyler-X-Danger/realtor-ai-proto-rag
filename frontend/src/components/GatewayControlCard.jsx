import { useState } from 'react'

export default function GatewayControlCard() {
  const [apiPath, setApiPath] = useState('')
  const [registered, setRegistered] = useState([])
  const [cacheClearing, setCacheClearing] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [accessRequested, setAccessRequested] = useState(false)

  function handleRegister() {
    if (!apiPath.trim()) return
    setRegistered((prev) => [{ path: apiPath.trim(), ts: new Date().toLocaleTimeString() }, ...prev])
    setApiPath('')
  }

  function handleClearCache() {
    setCacheClearing(true)
    setTimeout(() => {
      setCacheClearing(false)
      setCacheCleared(true)
      setTimeout(() => setCacheCleared(false), 3000)
    }, 1200)
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-sky-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-white">Gateway Control</h2>
      </div>

      {/* Register new API path */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-400 block">Register New API Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiPath}
            onChange={(e) => setApiPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            placeholder="/v2/listings/semantic-search"
            className="flex-1 rounded-md bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-500 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleRegister}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Register
          </button>
        </div>
        {registered.length > 0 && (
          <ul className="space-y-1 max-h-24 overflow-y-auto">
            {registered.map((r, i) => (
              <li key={i} className="flex items-center justify-between bg-slate-700/40 rounded px-2.5 py-1.5">
                <span className="text-xs font-mono text-emerald-400">{r.path}</span>
                <span className="text-xs text-slate-500">{r.ts}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700" />

      {/* Semantic cache */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200">Semantic Cache</p>
          <p className="text-xs text-slate-500 mt-0.5">Namespace: search-ai-semantic-v2 · 1,204 entries</p>
        </div>
        <button
          onClick={handleClearCache}
          disabled={cacheClearing}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            cacheCleared
              ? 'bg-emerald-600/30 text-emerald-400 cursor-default'
              : cacheClearing
              ? 'bg-slate-700 text-slate-400 cursor-wait'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {cacheCleared ? '✓ Cleared' : cacheClearing ? 'Clearing…' : 'Clear Cache'}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700" />

      {/* High-tier model access */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200">High-Tier Model Access</p>
          <p className="text-xs text-slate-500 mt-0.5">Claude 3.5 Sonnet · requires EM + AmpAI Hub approval</p>
        </div>
        <button
          onClick={() => setAccessRequested(true)}
          disabled={accessRequested}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            accessRequested
              ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 cursor-default'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {accessRequested ? '⏳ Pending Approval' : 'Request Access'}
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg bg-slate-700/40 border border-slate-600/50 px-3 py-2.5 flex items-start gap-2">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <p className="text-xs text-slate-400">
          Gateway base URL: <code className="text-slate-300 font-mono">ai-gateway.internal.realtor.com/v1</code>.
          PII scrubbing is active on all routes. Tier-1 cap resets at 00:00 UTC.
        </p>
      </div>
    </div>
  )
}
