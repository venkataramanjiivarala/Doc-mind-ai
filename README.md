# Chat with PDF — RAG Full-Stack App

Upload a PDF, ask questions, get answers grounded in the document — powered by
**Next.js**, **Supabase (Postgres + pgvector)**, and **Groq**.

This is an **open, no-login app**: anyone with the link can upload PDFs, chat
with them, and see the shared document library and chat history. Don't
upload sensitive/private documents. (Want auth back? See the note at the
bottom.)

Includes:
- 🌗 **Light/dark theme** — persisted per-browser, no flash on load
- 🕘 **Shared history** — every uploaded document and every message is saved and reloaded on revisit
- 🧭 **Sidebar UI** — document library, one-click delete, mobile-responsive
- ✨ **Polished chat UI** — avatars, streaming responses, typing indicator

---

## 1. Architecture

```
                         ┌─────────────────────────┐
                         │        Browser           │
                         │  (React UI: sidebar,      │
                         │   upload, chat)           │
                         └────────────┬─────────────┘
                                      │ HTTPS
                                      ▼
                  ┌───────────────────────────────────┐
                  │        Next.js App (Vercel)        │
                  │                                     │
                  │  /app/page.tsx  — Dashboard UI      │
                  │  /app/api/upload — ingestion route  │
                  │  /app/api/chat   — RAG chat route   │
                  └───────┬─────────────────────┬───────┘
                          │                     │
             extract+embed│                     │embed question
             chunks        │                     │+ retrieve + prompt
                          ▼                     ▼
             ┌─────────────────────┐   ┌─────────────────────┐
             │  Local embedding     │   │      Groq API        │
             │  model (transformers │   │  (Llama 3.3 70B, or  │
             │  .js, runs in the    │   │   any Groq model)    │
             │  serverless function)│   │  chat completions,   │
             │  no external API key │   │  streamed response   │
             └──────────┬───────────┘   └───────────┬──────────┘
                        │                            │
                        ▼                            │
             ┌────────────────────────────────────┐  │
             │             Supabase                │◄─┘ (retrieved context)
             │  Postgres + pgvector                │
             │  - documents table (shared library)  │
             │  - document_chunks table (vectors)   │
             │  - messages table (shared history)   │
             │  - match_document_chunks() RPC       │
             │    (cosine similarity search)        │
             └────────────────────────────────────┘
```

### Request flow

**Upload (`POST /api/upload`)**
1. User drops a PDF in the browser → sent as `multipart/form-data`.
2. Server route extracts text with `pdf-parse`.
3. Text is split into overlapping chunks (`lib/chunk.ts`).
4. Each chunk is embedded locally with `@xenova/transformers`
   (`Xenova/all-MiniLM-L6-v2`, 384-dim) — **no external embeddings API key needed**.
5. Chunks + embeddings are stored in Supabase (`document_chunks` table, pgvector column).

**Chat (`POST /api/chat`)**
1. User's question is embedded with the same local model.
2. Supabase RPC `match_document_chunks` does a cosine-similarity search
   (pgvector `<=>` operator) scoped to the current document.
3. Top matching chunks are assembled into a context block.
4. Context + question + short chat history are sent to **Groq** (`groq-sdk`)
   using an OpenAI-compatible chat-completions call, streamed token-by-token
   back to the browser.
5. The question and the full streamed answer are saved to `messages`.
   Reopening a document later reloads this history from Supabase.

### No auth — what that means
- There's no login wall. `documents` and `messages` are readable/writable by
  anyone holding the Supabase anon key (i.e. anyone who loads the app).
- Row Level Security is still enabled on all tables, but the policies are
  intentionally permissive (`using (true)`) rather than scoped to a user —
  this keeps the DB-level security model in place structurally, in case you
  want to reintroduce per-user scoping later (see section 7).
- The service-role key is still only ever used server-side (API routes),
  never exposed to the browser — that boundary didn't change.

### Why this stack works well on Vercel
- Next.js App Router API routes deploy as Vercel Serverless Functions automatically.
- `runtime = "nodejs"` is set on both API routes because `pdf-parse` and
  `@xenova/transformers` need the full Node runtime (not Edge).
- `maxDuration = 60` gives PDF processing/embedding room to finish (raise your
  Vercel plan if you need longer than 60s for very large PDFs).
- No embeddings API key is required — the embedding model runs inside the
  function itself, so the only secrets you manage are Supabase + Groq.

---

## 2. Project structure / modules

```
chat-with-pdf/
├── app/
│   ├── page.tsx                 # Renders the Dashboard (no auth check)
│   ├── layout.tsx               # Theme init script + ThemeProvider
│   ├── globals.css
│   └── api/
│       ├── upload/route.ts      # PDF ingestion pipeline
│       └── chat/route.ts        # RAG retrieval + Groq streaming + history save
├── components/
│   ├── Dashboard.tsx            # Orchestrates sidebar + upload/chat views
│   ├── Sidebar.tsx              # Document history, theme toggle
│   ├── FileUpload.tsx           # Drag-and-drop PDF uploader
│   ├── ChatWindow.tsx           # Streaming chat UI, loads saved history
│   ├── ThemeProvider.tsx        # Light/dark theme context + no-flash script
│   └── ThemeToggle.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser client (anon key)
│   │   └── admin.ts             # Service-role client (server-only)
│   ├── embeddings.ts            # Local embedding model (transformers.js)
│   ├── chunk.ts                 # Text chunking utility
│   └── groq.ts                  # Groq client
├── supabase/
│   └── schema.sql               # Tables, pgvector index, match RPC, RLS
├── .env.example
├── next.config.js
├── package.json
└── README.md
```

---

## 3. Setup

### 3.1 Supabase
1. Create a project at https://supabase.com.
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → run it.
   This enables `pgvector`, creates `documents` / `document_chunks` /
   `messages`, and the `match_document_chunks` similarity-search function.

   > Safe to re-run if you're upgrading from an earlier version of this
   > project — every statement uses `if not exists` / `or replace` / policy
   > drop-then-create.

3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the browser)

   > This app also works with Vercel's **Supabase connect / integration**
   > option — connecting it via the Vercel Marketplace/Integrations tab will
   > auto-populate `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   > in your Vercel project. The integration typically does **not** add
   > `SUPABASE_SERVICE_ROLE_KEY` automatically — copy that one manually from
   > Supabase → Settings → API.

### 3.2 Groq
1. Get a free API key at https://console.groq.com/keys.
2. Set `GROQ_API_KEY`. Default model is `llama-3.3-70b-versatile`
   (override with `GROQ_MODEL` — any current Groq chat model works).

### 3.3 Local development
```bash
npm install
cp .env.example .env.local   # fill in your real keys
npm run dev
```
Visit http://localhost:3000.

---

## 4. Deploy to Vercel

**Option A — CLI**
```bash
npm i -g vercel
vercel
# then set env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GROQ_API_KEY
vercel --prod
```

**Option B — Dashboard**
1. Push this project to a GitHub repo.
2. In Vercel: **New Project → Import** your repo.
3. Use the **Supabase** integration/connect option from the Vercel
   Marketplace (or add env vars manually under **Settings → Environment
   Variables**) using the values from step 3.1/3.2 above.
4. Deploy. No other configuration is required.

> **Note on plans:** the API routes are configured with `maxDuration = 60`.
> Vercel's Hobby plan supports this; if you upload very large PDFs and hit
> timeouts, either upgrade your plan or lower `MAX_PDF_SIZE_MB`.

---

## 5. Environment variables reference

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS — used by API routes to write chunks/messages |
| `GROQ_API_KEY` | server only | Groq chat completions |
| `GROQ_MODEL` | server only | Optional, defaults to `llama-3.3-70b-versatile` |
| `MAX_PDF_SIZE_MB` | server only | Optional, defaults to `15` |

---

## 6. Already included
- Shared document library with a sidebar history list (click to reopen, delete to remove)
- Persisted chat history per document, reloaded on revisit
- Light/dark theme toggle, persisted in `localStorage`, no flash on load
- Mobile-responsive layout (collapsible sidebar)
- Streaming chat responses with a typing indicator

## 7. Extending this app
- **Bring auth back**: Supabase Auth + Next.js middleware can be reintroduced to scope `documents`/`messages` per user — add a `user_id` column back to both tables and change the RLS policies from `using (true)` to `using (auth.uid() = user_id)`.
- **Better retrieval**: increase `match_count`, add re-ranking, or hybrid keyword+vector search.
- **Bigger PDFs**: switch chunk embedding to batched calls, or move ingestion to a background job (e.g. Supabase Edge Function / queue) if you outgrow serverless time limits.
- **Rename/delete UX**: add inline rename for documents, or a "clear all history" action.
