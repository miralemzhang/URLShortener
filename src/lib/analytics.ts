import {
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  format,
  parseISO,
} from 'date-fns'
import { prisma } from '@/lib/prisma'

export type ClickSeriesPoint = {
  /** ISO date yyyy-MM-dd */
  date: string
  /** Short label for chart axis */
  label: string
  clicks: number
}

/** Global click counts per calendar day for the last 7 days (today + 6 prior days). */
export async function getClickSeriesLast7Days(): Promise<ClickSeriesPoint[]> {
  const now = new Date()
  const rangeStart = startOfDay(subDays(now, 6))
  const rangeEnd = endOfDay(now)

  const dayList = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const keys = dayList.map((d) => format(d, 'yyyy-MM-dd'))

  const counts = new Map<string, number>()
  for (const k of keys) counts.set(k, 0)

  const clicks = await prisma.click.findMany({
    where: {
      clickedAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: { clickedAt: true },
  })

  for (const c of clicks) {
    const k = format(startOfDay(c.clickedAt), 'yyyy-MM-dd')
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return keys.map((date) => ({
    date,
    label: format(parseISO(date), 'MMM d'),
    clicks: counts.get(date) ?? 0,
  }))
}
