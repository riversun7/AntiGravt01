import Link from "next/link";
import { ArrowRight, Zap, Globe, Shield } from "lucide-react";

/**
 * @file page.tsx
 * @description 게임의 랜딩 페이지 (Landing Page)
 * @role 게임 소개, 로그인/대시보드 진입점 제공, 주요 기능 홍보
 * @dependencies next/link, lucide-react
 * @status Active
 */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <main className="flex flex-col gap-8 items-center text-center max-w-2xl z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-surface-border bg-surface-light text-xs text-primary tracking-wider uppercase">
          <Zap size={14} className="animate-pulse" />
          <span>System Online: v0.1.0</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary">
          TERRA<br />IN-COGNITA
        </h1>

        <p className="text-lg text-gray-400 max-w-lg">
          Explore the infinite unknown. Manage your territory, invest in the economy, and survive the wild.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row mt-4">
          <Link
            href="/dashboard"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-primary text-primary-foreground gap-2 hover:bg-primary/90 text-sm sm:text-base h-12 px-8 font-bold"
          >
            Gamestart (Login)
            <ArrowRight size={18} />
          </Link>
          <button className="rounded-full border border-solid border-white/[.15] transition-colors flex items-center justify-center hover:bg-white/[.1] hover:border-transparent text-sm sm:text-base h-12 px-8 sm:min-w-44 text-white">
            World Guide
          </button>
        </div>
      </main>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mt-8">
        <FeatureCard
          icon={<Globe className="text-primary" />}
          title="Infinite World"
          desc="The earth is not round. It is endless. Explore the unknown."
        />
        <FeatureCard
          icon={<Zap className="text-accent" />}
          title="Magitech Economy"
          desc="Invest in stocks, manage resources, and control inflation."
        />
        <FeatureCard
          icon={<Shield className="text-secondary" />}
          title="Survival & Growth"
          desc="Build your city, defend against creatures, and expand."
        />
      </div>

      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center text-xs text-gray-600 mt-auto">
        <span>© 2025 Antigravity Games</span>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-3 items-center text-center hover:border-primary/50 transition-colors cursor-default">
      <div className="p-3 rounded-full bg-surface-light border border-surface-border mb-1">
        {icon}
      </div>
      <h3 className="font-bold text-white">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  )
}
