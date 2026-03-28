import Link from 'next/link'
import { Link2, ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getClickSeriesLast7Days } from '@/lib/analytics'
import LinkTable from './link-table'
import { ClickTrendChart } from './click-trend-chart'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const links = await prisma.link.findMany({
    include: { _count: { select: { clicks: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const rows = links.map((l) => ({
    id: l.id,
    shortCode: l.shortCode,
    originalUrl: l.originalUrl,
    title: l.title,
    domain: l.domain,
    imageUrl: l.imageUrl,
    createdAt: l.createdAt.toISOString(),
    clickCount: l._count.clicks,
  }))

  const totalClicks = rows.reduce((sum, l) => sum + l.clickCount, 0)
  const clickTrend = await getClickSeriesLast7Days()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-lg text-indigo-600">
          <Link2 className="w-5 h-5" />
          Snip
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            All your shortened links in one place.
          </p>
        </div>

        <ClickTrendChart data={clickTrend} />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total links
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {rows.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total clicks
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {totalClicks}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Avg clicks / link
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {rows.length > 0
                ? (totalClicks / rows.length).toFixed(1)
                : '—'}
            </p>
          </div>
        </div>

        {/* Table */}
        <LinkTable links={rows} />
      </main>
    </div>
  )
}
