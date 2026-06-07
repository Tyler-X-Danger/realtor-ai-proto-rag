const teams = [
  { slug: 'search-ai', spend: 1.84, calls: 412, cap: 50.0 },
  { slug: 'listing-intelligence', spend: 0.97, calls: 289, cap: 50.0 },
  { slug: 'lead-scoring', spend: 0.43, calls: 103, cap: 1.5 },
  { slug: 'copy-gen', spend: 0.18, calls: 43, cap: 1.5 },
]

function BurnBar({ value, max, warn = 0.7, danger = 0.9 }) {
  const pct = Math.min(value / max, 1)
  const color =
    pct >= danger ? 'bg-red-500' : pct >= warn ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${(pct * 100).toFixed(1)}%` }}
      />
    </div>
  )
}

export default function TokenAnalyticsCard() {
  const totalSpend = teams.reduce((s, t) => s + t.spend, 0)
  const totalCalls = teams.reduce((s, t) => s + t.calls, 0)
  const tierOneCap = 50.0
  const burnPct = ((totalSpend / tierOneCap) * 100).toFixed(0)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      {/* Card header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-violet-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white">Token Analytics</h2>
        </div>
        <span className="text-xs text-slate-500">Resets 00:00 UTC · Tier-1 (Claude 3.5 Sonnet / GPT-4o)</span>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-700/40 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-1">Daily Spend</p>
          <p className="text-2xl font-bold text-white">${totalSpend.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">of ${tierOneCap.toFixed(2)} cap</p>
          <div className="mt-2">
            <BurnBar value={totalSpend} max={tierOneCap} />
          </div>
          <p className="text-xs text-amber-400 mt-1">{burnPct}% burned</p>
        </div>

        <div className="bg-slate-700/40 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-1">Gateway Calls Today</p>
          <p className="text-2xl font-bold text-white">{totalCalls.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">across all teams</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400">All routes healthy</span>
          </div>
        </div>

        <div className="bg-slate-700/40 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-1">Cache Hit Rate</p>
          <p className="text-2xl font-bold text-white">73%</p>
          <p className="text-xs text-slate-500 mt-1">semantic · threshold 0.92</p>
          <div className="mt-2">
            <BurnBar value={73} max={100} warn={0} danger={101} />
          </div>
          <p className="text-xs text-emerald-400 mt-1">↓ 27% miss rate</p>
        </div>
      </div>

      {/* Team breakdown table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Team Breakdown</p>
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400">Team</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400">Spend</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400">Calls</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 w-40">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {teams.map((t) => (
                <tr key={t.slug} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{t.slug}</td>
                  <td className="px-4 py-3 text-white font-medium">${t.spend.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400">{t.calls}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <BurnBar value={t.spend} max={t.cap} />
                      </div>
                      <span className="text-xs text-slate-500 w-16 text-right">{((t.spend / t.cap) * 100).toFixed(0)}% of ${t.cap}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
