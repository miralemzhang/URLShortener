# Engineering Log — URL Shortener (VibeInterview Assessment)

**Date**: 2026-03-27 / 2026-03-28
**Task**: Build a URL shortener with rich previews, custom aliases, click analytics, and a management dashboard
**Stack chosen**: Next.js 16 (App Router) · Prisma 7 · SQLite · Tailwind CSS v4 · Microlink.io

---

## Overview

This log documents the real engineering decisions, blockers, and debugging processes encountered during the assessment. The project was completed under time pressure in a constrained environment, requiring hands-on problem solving at every layer of the stack.

---

## 1. Environment Setup — Fork Errors Blocked the Bash Shell

### Problem

The AI coding assistant relies on a bash subprocess to run shell commands (npm install, prisma generate, etc.). On this Windows 11 machine, the bash environment failed to fork child processes throughout the session:

```
0 [main] bash 1128 dofork: child -1 - forked process died unexpectedly
/etc/profile: fork: retry: Resource temporarily unavailable
```

The error (`EAGAIN` / `0xC0000142`) repeats with exponential backoff and eventually gives up. This is a known issue on Windows when the system runs out of process handles or when Git Bash is running in a resource-constrained context.

### Impact

**No shell commands could be executed by the assistant.** Every step that would normally be automated had to be done manually in a separate terminal.

### Resolution

I manually ran all setup steps in my own Windows terminal (PowerShell / Command Prompt):

```bash
# Step 1 — Scaffold project
npx create-next-app@latest url-shortener --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack

# Step 2 — Install Prisma + database adapter
npm install @prisma/client @prisma/adapter-libsql @libsql/client
npm install -D prisma

# Step 3 — Install UI and utility libraries
npm install nanoid cheerio recharts date-fns zod lucide-react

# Step 4 — Initialize Prisma (SQLite)
npx prisma init --datasource-provider sqlite

# Step 5 — Generate client after writing schema
npx prisma generate

# Step 6 — Run migration
npx prisma migrate dev --name init
```

**Key learning**: Environment fragility is a real factor in vibe coding workflows. When tooling fails, the ability to fall back to manual execution without losing momentum is essential.

---

## 2. Prisma 7 — A Completely Different Beast

### Problem

Prisma 7 (released ~2025) introduced breaking changes from v5/v6 that are not reflected in most training data or online tutorials:

| Behavior | Prisma ≤ 6 | Prisma 7 |
|----------|-----------|---------|
| `schema.prisma` datasource URL | `url = env("DATABASE_URL")` | **No `url` field** — removed entirely |
| Client instantiation | `new PrismaClient()` | **Requires `adapter` or `accelerateUrl`** — plain constructor throws |
| Config for migrations | Inline in schema | Separate `prisma.config.ts` file |
| Client output | `node_modules/@prisma/client` | **Custom output** in `src/generated/prisma/` |
| Client entry point | `@prisma/client` | `@/generated/prisma/client` (custom path) |

### Discovery Process

**Error 1**: `npx prisma init` generated a schema with no `url` field in the datasource block — initially thought it was a bug, but this is intentional in Prisma 7. The URL now belongs in `prisma.config.ts`.

**Error 2**: `new PrismaClient()` without arguments threw immediately. Prisma 7 requires a driver adapter:
```
Error: PrismaClient requires either 'adapter' or 'accelerateUrl' to be set.
```

**Error 3**: Importing `PrismaClient` from `@prisma/client` failed — the generated client lives in `src/generated/prisma/client.ts` (not `index.ts`).

**Error 4**: `PrismaLibSQL` does not exist — the correct export is `PrismaLibSql` (lowercase `q`).

### Resolution

```typescript
// prisma/schema.prisma — NO url field in datasource
datasource db {
  provider = "sqlite"
  // url is intentionally absent in Prisma 7
}

// prisma.config.ts — url lives here (for CLI migrations only)
import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});

// src/lib/prisma.ts — runtime adapter
import { PrismaLibSql } from '@prisma/adapter-libsql'   // Note: PrismaLibSql not PrismaLibSQL
import { PrismaClient } from '@/generated/prisma/client'  // Note: custom output path

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
```

**Key learning**: Prisma 7 separates "migration-time config" (prisma.config.ts) from "runtime config" (the adapter object). The generated client is not a re-export of `@prisma/client` — it is a standalone TypeScript module that imports runtime utilities from `@prisma/client/runtime/client`.

---

## 3. Turbopack → Webpack Switch

### Problem

Next.js 16 defaults to Turbopack for `next dev`. After setting up Prisma with the LibSQL adapter, API routes failed silently. Investigation revealed that Turbopack was resolving `@libsql/client` to its **browser/web bundle** (`lib-esm/web.js`) instead of the Node.js bundle (`lib-cjs/node.js`).

The web bundle does not support `file:` URLs — it only supports `ws://`, `wss://`, `http://`, and `https://`. Any query against a local SQLite file would fail with `URL_SCHEME_NOT_SUPPORTED`.

`serverExternalPackages` in `next.config.ts` is supposed to prevent bundling of Node.js-specific packages, but under Turbopack (which uses a different module resolution pipeline), the export condition resolution behaved differently from expectations.

### Resolution

Switched dev script to use webpack:

```json
// package.json
"dev": "next dev --webpack"
```

Also added the relevant packages to `serverExternalPackages` so webpack treats them as Node.js externals (loaded via `require()` at runtime, not bundled):

```typescript
// next.config.ts
serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
```

And cleared the `.next` build cache to ensure no stale Turbopack artifacts remained.

**Key learning**: Turbopack and webpack do not have identical behavior around package export conditions. For packages with distinct node/browser bundles (like `@libsql/client`), webpack + `serverExternalPackages` is the more predictable path.

---

## 4. `URL_INVALID: The URL 'undefined'` — Root Cause Analysis

### The Error

```
URL_INVALID: The URL 'undefined' is not in a valid format
    at async POST (src/app/api/shorten/route.ts:64:7)
  > 64 |     ? await prisma.link.findFirst({ where: { originalUrl: url } })
```

This error persisted even after:
- Switching from Turbopack to webpack
- Clearing `.next` cache
- Verifying the adapter was correctly constructed
- Confirming `prisma/dev.db` existed in the right location

### Investigation

Traced the error to `@libsql/core/lib-cjs/uri.js:parseUri()`:

```javascript
function parseUri(text) {
    const match = URI_RE.exec(text);  // text is `undefined`
    if (match === null) {
        throw new LibsqlError(`The URL '${text}' is not in a valid format`, "URL_INVALID");
    }
```

The string interpolation `${undefined}` produces `"undefined"`, hence the confusing error message. The real issue: `parseUri` was being called with the JavaScript value `undefined`, not a bad URL string.

### Root Cause

The `originalUrl` field was reaching `prisma.link.findFirst()` as `undefined`. Tracing back through the call stack:

```typescript
const { url } = resolved   // ← `url` could be undefined
const existingByUrl = !alias
    ? await prisma.link.findFirst({ where: { originalUrl: url } })  // ← undefined passed here
```

The bug was in the **Zod 4 validation schema**. The original schema used patterns incompatible with Zod 4's `safeParse` behavior. In Zod 4, certain approaches (e.g., using `z.preprocess`) can cause a field to remain absent from the parsed output even when the input provides it. The result: `url` was `undefined` after parsing, silently.

When `url = undefined` reached `prisma.link.findFirst({ where: { originalUrl: undefined } })`, Prisma passed this through to the LibSQL adapter, which eventually called `createClient({ url: undefined })` → `expandConfig({ url: undefined })` → `parseUri(undefined)` → `URL_INVALID`.

### Fix

Rewrote the validation to explicitly separate Zod parsing from URL resolution:

```typescript
// Old approach (broken with Zod 4 z.preprocess or strict url() on top-level):
const bodySchema = z.object({
  url: z.string().url(),  // Could leave field undefined on parse failure
})

// New approach: accept loosely, validate separately
const bodySchema = z.object({
  url: z.string().optional(),
  originalUrl: z.string().optional(),
  alias: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  deferPreview: z.boolean().optional(),
})

function resolveUrl(data): { ok: true; url: string } | { ok: false; error: string } {
  const raw = data.url ?? data.originalUrl
  if (raw == null) return { ok: false, error: 'Valid url or originalUrl is required' }
  const trimmed = String(raw).trim()
  const check = z.string().url().safeParse(trimmed)
  if (!check.success) return { ok: false, error: 'Invalid URL format' }
  return { ok: true, url: check.data }
}
```

This guarantees that if `url` is not a valid string, execution returns a 400 error before any Prisma call — so `undefined` can never reach the database layer.

Also fixed `prisma.ts` to read `DATABASE_URL` from environment (which Next.js loads from `.env` automatically) rather than a hardcoded relative path:

```typescript
// Before: const adapter = new PrismaLibSql({ url: 'file:prisma/dev.db' })
// After:
const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const adapter = new PrismaLibSql({ url: databaseUrl })
```

**Key learning**: In Zod 4, do not rely on field-level `url()` validation to guarantee a non-undefined value in `safeParse` output when the field might be absent or when using `preprocess`. Validate the raw value explicitly after parsing.

---

## 5. Generated Prisma Client Module — Import Path Issues

### Problem

After running `npx prisma generate`, the client was generated to `src/generated/prisma/`. Importing from `@/generated/prisma` (without `/client`) failed because the entry point in Prisma 7's generated output is `client.ts`, not `index.ts`.

```
Module not found: Can't resolve '@/generated/prisma'
```

### Fix

```typescript
// Correct import for Prisma 7
import { PrismaClient } from '@/generated/prisma/client'
//                                              ^^^^^^^^ required
```

---

## 6. Deferred Preview Pattern — UX Design Decision

### Problem

Microlink.io can take 1–3 seconds to respond. Making the user wait before seeing their short link creates poor UX.

### Solution

Implemented a two-phase flow:

**Phase 1** — Client submits URL with `deferPreview: true`:
- Server creates the Link record immediately (no Microlink call)
- Returns `{ link, deferredPreview: true }` within ~50ms
- Client displays the short link immediately

**Phase 2** — Client calls `POST /api/links/[shortCode]/enrich`:
- Server calls Microlink API (potentially slow)
- Updates `title`, `description`, `imageUrl` in the database
- Client updates the preview card with enriched data

While Phase 2 is in-flight, an animated skeleton (`animate-pulse`) is shown in the preview card. This gives clear visual feedback without blocking the primary action.

---

## 7. Summary of Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Zero config, single file, perfect for assessment scope |
| Prisma 7 with LibSQL adapter | Official SQLite support path in Prisma 7 |
| webpack over Turbopack for dev | Turbopack had module resolution issues with `@libsql/client` browser bundle |
| Microlink.io over cheerio scraping | Reliable, free, handles JS-rendered pages; cheerio fails on SPAs |
| Deferred preview (two-phase fetch) | Keeps perceived latency <100ms; skeleton shows progress |
| Zod 4 loose parsing + explicit URL resolver | Avoids Zod 4's `safeParse` behavior leaking `undefined` into DB queries |
| `serverExternalPackages` for LibSQL | Prevents webpack from bundling native Node.js modules |
| `force-dynamic` on dashboard | Ensures fresh DB reads on every request (no stale cached renders) |

---

## 8. Files Modified / Created

```
prisma/
  schema.prisma          — Prisma 7 format (no url in datasource)
  migrations/            — Generated by prisma migrate dev

src/
  lib/prisma.ts          — Singleton with LibSQL adapter + env-based URL
  lib/microlink.ts       — Metadata fetch + domain extraction
  lib/analytics.ts       — 7-day click aggregation query
  app/page.tsx           — Home page (deferred preview flow)
  app/layout.tsx         — Root layout
  app/[code]/route.ts    — Redirect handler
  app/api/shorten/route.ts          — POST: create link (Zod 4 fix)
  app/api/links/[shortCode]/enrich/ — POST: enrich metadata
  app/api/analytics/clicks/         — GET: 7-day series
  app/dashboard/page.tsx            — Server component dashboard
  app/dashboard/link-table.tsx      — Client sortable/searchable table
  app/dashboard/click-trend-chart.tsx — Recharts line chart

next.config.ts           — serverExternalPackages + reactCompiler
package.json             — dev script uses --webpack flag
prisma.config.ts         — Prisma 7 migration config
.env                     — DATABASE_URL
```
