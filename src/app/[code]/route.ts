import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const link = await prisma.link.findUnique({ where: { shortCode: code } })
  if (!link) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.click.create({ data: { linkId: link.id } })

  return Response.redirect(link.originalUrl, 301)
}
