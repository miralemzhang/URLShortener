import { NextResponse } from 'next/server'
import { getClickSeriesLast7Days } from '@/lib/analytics'

/** Global click trend for the past 7 days (one bucket per calendar day). */
export async function GET() {
  const series = await getClickSeriesLast7Days()
  return NextResponse.json({ series })
}
