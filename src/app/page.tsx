'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Link2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  LayoutDashboard,
} from 'lucide-react'

type LinkResult = {
  id: string
  shortCode: string
  originalUrl: string
  title: string | null
  description: string | null
  imageUrl: string | null
  domain: string | null
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [alias, setAlias] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [result, setResult] = useState<LinkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shortUrl = result
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${result.shortCode}`
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          alias: alias.trim() || undefined,
          deferPreview: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      setResult(data.link)

      if (data.deferredPreview === true) {
        setPreviewBusy(true)
        try {
          const enrichRes = await fetch(
            `/api/links/${data.link.shortCode}/enrich`,
            { method: 'POST' }
          )
          const enriched = await enrichRes.json()
          if (enrichRes.ok && enriched.link) {
            setResult(enriched.link)
          }
        } finally {
          setPreviewBusy(false)
        }
      }
    } catch {
      setError('Network error, please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-lg text-indigo-600">
          <Link2 className="w-5 h-5" />
          Snip
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          {/* Title */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
              Shorten. Share.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">
                Track.
              </span>
            </h1>
            <p className="text-slate-500 text-lg">
              Paste a long URL and get a clean short link with rich preview.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <div className="flex gap-2 bg-white rounded-2xl shadow-md border border-slate-200 p-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/very-long-url..."
                required
                className="flex-1 px-3 py-2.5 text-slate-800 placeholder-slate-400 bg-transparent outline-none text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {loading ? 'Shortening…' : 'Shorten'}
              </button>
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors self-end cursor-pointer"
            >
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {showAdvanced ? 'Hide' : 'Advanced'} options
            </button>

            {showAdvanced && (
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  Custom alias
                </span>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="my-link"
                  pattern="[a-zA-Z0-9_-]+"
                  className="flex-1 text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            )}
          </form>

          {/* Error */}
          {error && (
            <div className="w-full bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Preview Card */}
          {result && (
            <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {previewBusy ? (
                <div className="w-full h-48 bg-slate-100 animate-pulse" />
              ) : (
                result.imageUrl && (
                  <div className="w-full h-48 bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt={result.title ?? ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )
              )}

              <div className="p-5 flex flex-col gap-4">
                {/* Meta */}
                <div className="flex gap-3 items-start">
                  {!previewBusy && result.domain && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${result.domain}&sz=32`}
                      alt=""
                      className="w-6 h-6 rounded mt-0.5 shrink-0"
                    />
                  )}
                  {previewBusy && (
                    <div className="w-6 h-6 rounded bg-slate-200 animate-pulse shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    {previewBusy ? (
                      <>
                        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-full max-w-sm bg-slate-200 rounded animate-pulse mt-2" />
                        <div className="h-4 w-full max-w-md bg-slate-200 rounded animate-pulse mt-2" />
                      </>
                    ) : (
                      <>
                        {result.domain && (
                          <span className="text-xs text-slate-400 uppercase tracking-wide">
                            {result.domain}
                          </span>
                        )}
                        {result.title && (
                          <h2 className="text-base font-semibold text-slate-800 line-clamp-2">
                            {result.title}
                          </h2>
                        )}
                        {result.description && (
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {result.description}
                          </p>
                        )}
                        {!result.title && !result.description && (
                          <p className="text-sm text-slate-400 italic">
                            No preview available
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Short link row */}
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm font-medium text-indigo-600 truncate hover:underline flex items-center gap-1.5 min-w-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{shortUrl}</span>
                  </a>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-600"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
