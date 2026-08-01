-- ============================================================
-- Chat with PDF — Supabase schema (v3: no auth, public/shared)
-- Run this in Supabase Dashboard > SQL Editor.
-- Safe to re-run: uses "if not exists" / "or replace" everywhere.
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Documents table — one row per uploaded PDF (shared library, no owner)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  page_count int,
  status text not null default 'processing', -- processing | ready | error
  error_message text,
  created_at timestamptz not null default now()
);

-- 3. Document chunks table — text chunk + embedding
-- Embedding dimension = 384 (Xenova/all-MiniLM-L6-v2)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(384),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Messages table — chat history per document (shared, no owner)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_document_id_idx on messages (document_id);
create index if not exists messages_document_created_idx on messages (document_id, created_at);

-- 5. Similarity search RPC used by /api/chat
create or replace function match_document_chunks(
  query_embedding vector(384),
  match_count int default 5,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where filter_document_id is null
     or document_chunks.document_id = filter_document_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Row Level Security
-- This app has no login — it's a shared/public library, so `documents`
-- and `messages` are readable and writable by anyone holding the anon
-- key (i.e. anyone using the app). document_chunks stays fully locked
-- since it's only ever touched server-side via the service-role key.
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table messages enable row level security;

drop policy if exists "Public can read documents" on documents;
create policy "Public can read documents"
  on documents for select
  using (true);

drop policy if exists "Public can insert documents" on documents;
create policy "Public can insert documents"
  on documents for insert
  with check (true);

drop policy if exists "Public can delete documents" on documents;
create policy "Public can delete documents"
  on documents for delete
  using (true);

drop policy if exists "Public can read messages" on messages;
create policy "Public can read messages"
  on messages for select
  using (true);

-- ============================================================
-- Notes
-- ============================================================
-- * There is no auth in this version — every visitor shares the same
--   document library and chat history. Do not upload sensitive/private
--   PDFs. If you need per-user privacy later, reintroduce Supabase Auth
--   and swap these `using (true)` policies for `auth.uid() = user_id`
--   checks (see project history / README for the auth-enabled version).
-- * document_chunks intentionally has no public policy — it's only
--   read/written by the server (service-role key) via the API routes.
-- * messages are inserted server-side only (via /api/chat using the
--   service-role key), so there's no public insert policy for them.
