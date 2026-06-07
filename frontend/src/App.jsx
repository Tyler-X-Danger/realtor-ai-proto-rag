import Sidebar from './components/Sidebar'
import TokenAnalyticsCard from './components/TokenAnalyticsCard'
import GatewayControlCard from './components/GatewayControlCard'
import AIChatCard from './components/AIChatCard'

export default function App() {
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="bg-slate-800 border-b border-slate-700 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-white">AmpAI Hub</h1>
            <p className="text-xs text-slate-400 mt-0.5">Internal Developer Portal — Realtor.com</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gateway Online
            </span>
            <span className="text-xs text-slate-500">ai-gateway-prod-us-west-2</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card A — full width */}
          <TokenAnalyticsCard />

          {/* Executive Value Realization & ROI Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Time Displaced YTD</p>
              <p className="text-3xl font-bold text-white">14,250 Hours</p>
              <p className="text-xs text-slate-400 mt-2">Calculated across 800+ active engineering profiles using Claude Code and Windsurf.</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Infrastructure Cost Avoided</p>
              <p className="text-3xl font-bold text-white">$420,000</p>
              <p className="text-xs text-slate-400 mt-2">Driven via Portkey semantic caching and tiered LLM model routing optimization.</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">AI Hub Adoption & Enablement</p>
              <p className="text-3xl font-bold text-white">312 / 800 Certified</p>
              <p className="text-xs text-slate-400 mt-2">Engineers who completed the internal micro-certification track and active peer-led workshops.</p>
            </div>
          </div>

          {/* Cards B and C — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GatewayControlCard />
            <AIChatCard />
          </div>
        </main>
      </div>
    </div>
  )
}
