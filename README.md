# Snip — URL Shortener

A full-featured URL shortener with rich link previews, custom aliases, click analytics, and a management dashboard. Built as a VibeInterview coding assessment.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Run database migrations
npx prisma migrate deploy

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Requires Node.js 18+**

### Environment Variables

A `.env` file is included with local defaults — no changes needed:

```env
DATABASE_URL="file:./prisma/dev.db"
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 |
| UI | React 19.2.4 + Tailwind CSS v4 |
| Icons | Lucide React |
| Charts | Recharts |
| ORM | Prisma 7.6.0 |
| Database | SQLite via `@prisma/adapter-libsql` (LibSQL) |
| Validation | Zod 4 |
| ID Generation | nanoid |
| Date Utilities | date-fns |
| Metadata API | Microlink.io (free tier) |

---

## Features

### 1. URL Shortening
- Paste any long URL → get a 7-character short code instantly
- Short link displayed with a **copy-to-clipboard** button (visual "Copied!" feedback)
- Same URL submitted again → cached entry is reused (no duplicates, no redundant API calls)

### 2. Rich Link Previews
- Metadata (title, description, Open Graph image) fetched asynchronously from [Microlink.io](https://microlink.io)
- **Loading skeleton** shown while metadata is being fetched
- Preview card shows: hero image, favicon, domain, title, description
- **Graceful fallback**: if no OG data exists, displays domain + Google favicon

### 3. Custom Aliases
- Toggle "Advanced options" to enter a custom alias (e.g., `my-project-2025`)
- Validates format: alphanumeric, dash, underscore — max 50 chars
- Duplicate alias → `409 Conflict` + clear error message

### 4. Click Analytics
- Every redirect records a timestamped click event in the database
- **7-day time-series chart** (Recharts line chart) in the dashboard
- Per-link click counts shown in dashboard table

### 5. Link Management Dashboard (`/dashboard`)
- Table of all links: thumbnail, short code, original URL, click count, creation date
- **Search**: filter by URL, alias, or title
- **Sort**: click column headers to sort by date / clicks / code, toggle direction

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                         # Home (Client Component)
│   ├── layout.tsx                       # Root layout + Geist font
│   ├── [code]/route.ts                  # GET → record click + 301 redirect
│   ├── api/
│   │   ├── shorten/route.ts             # POST → create short link
│   │   ├── links/[shortCode]/enrich/    # POST → async metadata fetch
│   │   └── analytics/clicks/route.ts   # GET → 7-day click series
│   └── dashboard/
│       ├── page.tsx                     # Dashboard (Server Component)
│       ├── link-table.tsx              # Sortable/searchable table (Client)
│       └── click-trend-chart.tsx       # Line chart (Client)
├── lib/
│   ├── prisma.ts                        # Prisma singleton + LibSQL adapter
│   ├── microlink.ts                     # Metadata fetch + domain extraction
│   └── analytics.ts                     # 7-day click aggregation
└── generated/prisma/                    # Prisma 7 generated client
```

### Request Flow

```
POST /api/shorten
  → Validate URL (Zod 4)
  → Check alias uniqueness
  → Check URL cache (return existing if found)
  → Create Link record (nanoid code)
  → Return immediately (deferPreview: true)

POST /api/links/[code]/enrich  ← triggered by client after link created
  → Call Microlink API
  → Update Link.title / .description / .imageUrl
  → Return enriched link

GET /:code
  → Lookup Link by shortCode
  → Insert Click record
  → 301 Redirect to originalUrl
```

### Database Schema

```prisma
model Link {
  id          String   @id @default(cuid())
  shortCode   String   @unique
  originalUrl String
  title       String?
  description String?
  imageUrl    String?
  domain      String?
  createdAt   DateTime @default(now())
  clicks      Click[]
}

model Click {
  id        String   @id @default(cuid())
  linkId    String
  link      Link     @relation(fields: [linkId], references: [id])
  clickedAt DateTime @default(now())
}
```

---

## API Reference

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/shorten` | POST | `{ url, alias?, deferPreview? }` | Create short link |
| `/api/links/[code]/enrich` | POST | — | Fetch & persist metadata |
| `/api/analytics/clicks` | GET | — | 7-day click time-series |
| `/[code]` | GET | — | Record click + redirect |

---

## Design Rationale

The core design principle was **instant feedback with progressive enhancement**. Rather than blocking on the Microlink API (which can take 1–3 seconds), the short link is created and displayed immediately upon submission. Metadata loads asynchronously in the background, with an animated skeleton placeholder giving clear visual feedback that something is loading. This keeps the perceived latency near zero regardless of network conditions to the metadata API.

For the database layer, SQLite was chosen for its zero-configuration simplicity — no separate database server, no connection string management, and the entire application state lives in a single file (`prisma/dev.db`). Prisma 7 with the LibSQL adapter provides a fully type-safe query interface while keeping the local-only SQLite setup.

The UI follows a minimal design language: a single indigo/violet accent color, generous whitespace, and clear typographic hierarchy. The preview card deliberately mirrors "link unfurl" patterns familiar from messaging apps (Slack, iMessage), making the output immediately recognizable to users. The dashboard prioritizes scannability — sortable columns and a search bar let you locate any link in a large table instantly.

Custom alias validation enforces `[a-zA-Z0-9_-]+` to keep codes URL-safe without percent-encoding. Conflicts return `409 Conflict` immediately, giving unambiguous feedback. URL deduplication means shortening the same page twice reuses the existing entry — preserving click history and avoiding redundant Microlink API calls.

---

## Requirements Self-Check

### Core Features (Must Have)

| Requirement | Status | Implementation |
|-------------|--------|---------------|
| Accept long URL, generate unique short code | ✅ | 7-char nanoid, or user-supplied alias |
| Display resulting short link with copy-to-clipboard | ✅ | Preview card with Copy button + "Copied!" state |
| Rich link preview (title, description, OG image) | ✅ | Microlink.io API, stored in DB |
| Preview card displayed alongside the short link | ✅ | Rendered below form on home page |
| Custom aliases with duplicate validation | ✅ | "Advanced options" toggle; 409 on conflict |
| Click analytics — total click count | ✅ | Per-link `_count.clicks` in dashboard |
| Click analytics — 7-day time-series chart | ✅ | Recharts LineChart in dashboard |
| Link management dashboard | ✅ | `/dashboard` with table + chart |
| Dashboard: preview thumbnails | ✅ | OG image or Google favicon fallback |
| Dashboard: original URL column | ✅ | Truncated with external link |
| Dashboard: click count column | ✅ | With icon badge |
| Dashboard: creation date column | ✅ | Relative date (e.g., "2 hours ago") |

### API Integration

| Requirement | Status | Implementation |
|-------------|--------|---------------|
| Free metadata/preview API | ✅ | Microlink.io |
| Rich preview cards (image, title, description, domain) | ✅ | All four fields rendered |
| Async loading with skeleton while fetching | ✅ | `deferPreview` pattern + `animate-pulse` skeleton |
| Graceful fallback for missing OG data | ✅ | Domain + Google Favicon API |
| Cache preview data to avoid redundant API calls | ✅ | Same URL → reuse existing DB entry |

### UI Requirements

| Requirement | Status | Implementation |
|-------------|--------|---------------|
| Clean landing page with prominent URL input | ✅ | Centered hero, gradient background |
| Rich preview cards (thumbnail, title, description) | ✅ | Full preview card with skeleton |
| Dashboard with sortable, searchable table | ✅ | Sort by date/clicks/code; search bar |
| Responsive layout | ✅ | Flex/grid layout, mobile-friendly |

### Submission Guide

| Step | Status |
|------|--------|
| Public GitHub repository | ✅ |
| Clear setup instructions in README | ✅ (this document) |
| Design rationale (200–300 words) | ✅ (see section above) |
