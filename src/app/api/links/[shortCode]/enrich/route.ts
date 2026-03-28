import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchLinkMetadata } from '@/lib/microlink'

type Params = { params: Promise<{ shortCode: string }> }

/**
 * Fetches Open Graph / Microlink metadata for an existing link and persists it.
 * Used after a fast shorten (`deferPreview`) so previews load asynchronously.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { shortCode } = await params

  const link = await prisma.link.findUnique({ where: { shortCode } })
  if (!link) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const meta = await fetchLinkMetadata(link.originalUrl)

  const updated = await prisma.link.update({
    where: { id: link.id },
    data: {
      title: meta.title,
      description: meta.description,
      imageUrl: meta.imageUrl,
    },
  })

  return Response.json({ link: updated })
}
