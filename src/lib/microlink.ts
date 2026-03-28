/** Shared Microlink metadata fetch for shorten + enrich APIs. */

export type LinkMetadata = {
  title: string | null
  description: string | null
  imageUrl: string | null
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('microlink error')
    const json = await res.json()
    const data = json?.data
    return {
      title: data?.title ?? null,
      description: data?.description ?? null,
      imageUrl: data?.image?.url ?? null,
    }
  } catch {
    return { title: null, description: null, imageUrl: null }
  }
}

export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
