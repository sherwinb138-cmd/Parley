# Project map

A plain-English guide to every folder and file. Start here if you are new to the code.

## How the pieces fit

```
Buyer opens a dispute on PayPal
        │
        ▼
lib/paypal   reads the dispute, sends offers, closes cases      (talks to PayPal)
        │
        ▼
lib/db       saves the case, the evidence and the AI's results  (talks to the database)
        │
        ▼
lib/ai       links each claim to its evidence, writes the Policy check   (talks to the AI model)
        │
        ▼
app          the screens the buyer and seller see, and the routes behind the buttons
```

## Folders

| Folder | What lives here | Status |
|---|---|---|
| `app/` | Screens (`page.tsx`) and the server routes behind buttons (`app/api/.../route.ts`) | skeleton |
| `lib/paypal/` | Everything that talks to PayPal | written |
| `lib/db/` | Everything that talks to the database (Supabase) | client written |
| `lib/ai/` | Everything that talks to the AI model, plus the checker that verifies its answers | not built yet |
| `lib/settle/` | Plain code that prices the settlement options. No AI. | not built yet |
| `supabase/` | The database layout, as one SQL file to paste into Supabase | written |
| `scripts/` | Small programs run by hand from the terminal: tests, demo data | spikes written |
| `.github/workflows/` | A scheduled job that pings the app every 2 days so the free database stays awake | written |

## Files

| File | Job, in one line |
|---|---|
| `CLAUDE.md` | The full plan, every decision and every test result. The source of truth. |
| `PROJECT_MAP.md` | This guide. |
| `.env.example` | The list of secret keys the app needs, with empty values. |
| `.env.local` | Your real keys. Lives only on your computer; never uploaded. |
| `lib/paypal/token.ts` | Logs in to PayPal and keeps the login for a few hours. |
| `lib/paypal/client.ts` | Orders, payments and tracking, through PayPal's official Server SDK. |
| `lib/paypal/disputes.ts` | The seller's dispute actions: read, message, offer, full-refund close. |
| `lib/db/client.ts` | Opens the connection to the database. |
| `supabase/schema.sql` | Creates the tables: cases, evidence, claims, claim links, policy checks. |
| `app/api/health/route.ts` | A "are you alive?" check that reads the database once. |
| `app/page.tsx` | The home screen. |
| `app/layout.tsx`, `app/globals.css` | The frame and base styling shared by every screen. |
| `scripts/spike.ts` | First PayPal test (10 Nov). Kept as a record. |
| `scripts/spike2.ts` | Second PayPal test: order, capture, disputes, offer, accept, status. |
| `.github/workflows/keepalive.yml` | The every-2-days ping. |
| `package.json` | The list of libraries the app uses and the commands you can run. |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `AGENTS.md` | Tool settings. Rarely touched. |

## Rules that keep this readable

1. Every file starts with a comment that says what it does, in plain English.
2. One job per file. The file name says the job.
3. Code that talks to PayPal lives only in `lib/paypal/`; the database only in `lib/db/`; the AI only in `lib/ai/`.
4. This map is updated in the same commit as any new file.
