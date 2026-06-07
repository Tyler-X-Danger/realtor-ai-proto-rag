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
