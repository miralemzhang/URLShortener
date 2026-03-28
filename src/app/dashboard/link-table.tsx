'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Link2,
  MousePointerClick,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type LinkRow = {
  id: string
  shortCode: string
  originalUrl: string
  title: string | null
  domain: string | null
  imageUrl: string | null
  createdAt: string
  clickCount: number
}

type SortKey = 'createdAt' | 'clickCount' | 'shortCode'
type SortDir = 'asc' | 'desc'

function SortIcon({
  col,
  current,
  dir,
}: {
  col: SortKey
  current: SortKey
  dir: SortDir
}) {
  if (col !== current)
    return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
  return dir === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
  )
}

export default function LinkTable({ links }: { links: LinkRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = links
    .filter(
      (l) =>
        l.originalUrl.toLowerCase().includes(search.toLowerCase()) ||
        l.shortCode.toLowerCase().includes(search.toLowerCase()) ||
        (l.title ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortKey === 'clickCount') {
        cmp = a.clickCount - b.clickCount
      } else {
        cmp = a.shortCode.localeCompare(b.shortCode)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by URL, alias, or title…"
        className="w-full sm:w-80 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-300"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No links found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 w-12" />
                <th
                  className="px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                  onClick={() => toggleSort('shortCode')}
                >
                  <span className="flex items-center gap-1.5">
                    Short link
                    <SortIcon col="shortCode" current={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium text-slate-500">
                  Original URL
                </th>
                <th
                  className="px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                  onClick={() => toggleSort('clickCount')}
                >
                  <span className="flex items-center gap-1.5">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Clicks
                    <SortIcon
                      col="clickCount"
                      current={sortKey}
                      dir={sortDir}
                    />
                  </span>
                </th>
                <th
                  className="px-4 py-3 font-medium text-slate-500 cursor-pointer hover:text-slate-800 select-none"
                  onClick={() => toggleSort('createdAt')}
                >
                  <span className="flex items-center gap-1.5">
                    Created
                    <SortIcon col="createdAt" current={sortKey} dir={sortDir} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((link) => (
                <tr
                  key={link.id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                      {link.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : link.domain ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=64`}
                          alt=""
                          className="w-6 h-6"
                        />
                      ) : (
                        <Link2 className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </td>

                  {/* Short link */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={`${origin}/${link.shortCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        /{link.shortCode}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </a>
                      {link.title && (
                        <span className="text-xs text-slate-400 truncate max-w-40">
                          {link.title}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Original URL */}
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-800 truncate block max-w-xs transition-colors"
                      title={link.originalUrl}
                    >
                      {link.originalUrl}
                    </a>
                  </td>

                  {/* Clicks */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-medium px-2.5 py-1 rounded-full">
                      <MousePointerClick className="w-3 h-3" />
                      {link.clickCount}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {formatDistanceToNow(new Date(link.createdAt), {
                      addSuffix: true,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
