import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { extractDomain, fetchLinkMetadata } from '@/lib/microlink'

/** Zod 4: avoid `z.preprocess` here — it can leave `url` unset for `safeParse`, which then hits Prisma as undefined. */
const bodySchema = z.object({
  url: z.string().optional(),
  originalUrl: z.string().optional(),
  alias: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  /** When true, create the link immediately without Microlink; client should POST `/api/links/[shortCode]/enrich`. */
  deferPreview: z.boolean().optional(),
})

function resolveUrl(data: z.infer<typeof bodySchema>):
  | { ok: true; url: string }
  | { ok: false; error: string } {
  const raw = data.url ?? data.originalUrl
  if (raw == null) {
    return { ok: false, error: 'Valid url or originalUrl is required' }
  }
  const trimmed = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  if (!trimmed) {
    return { ok: false, error: 'Valid url or originalUrl is required' }
  }
  const check = z.string().url().safeParse(trimmed)
  if (!check.success) {
    return { ok: false, error: 'Invalid URL format' }
  }
  return { ok: true, url: check.data }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const resolved = resolveUrl(parsed.data)
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 400 })
  }
  const { url } = resolved

  const { alias, deferPreview } = parsed.data
  const shortCode = alias ?? nanoid(7)

  // Check for duplicate alias
  if (alias) {
    const existing = await prisma.link.findUnique({ where: { shortCode: alias } })
    if (existing) {
      return Response.json({ error: 'Alias already taken' }, { status: 409 })
    }
  }

  // Check if we already have this URL (cache hit — reuse metadata)
  const existingByUrl = !alias
    ? await prisma.link.findFirst({ where: { originalUrl: url } })
    : null

  if (existingByUrl) {
    return Response.json(
      { link: existingByUrl, deferredPreview: false },
      { status: 200 }
    )
  }

  const domain = extractDomain(url)

  if (deferPreview === true) {
    const link = await prisma.link.create({
      data: {
        shortCode,
        originalUrl: url,
        domain,
        title: null,
        description: null,
        imageUrl: null,
      },
    })
    return Response.json({ link, deferredPreview: true }, { status: 201 })
  }

  const meta = await fetchLinkMetadata(url)

  const link = await prisma.link.create({
    data: {
      shortCode,
      originalUrl: url,
      domain,
      title: meta.title,
      description: meta.description,
      imageUrl: meta.imageUrl,
    },
  })

  return Response.json({ link, deferredPreview: false }, { status: 201 })
}
