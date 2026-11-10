-- Parley database. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to run more than once.

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  paypal_dispute_id text unique not null,
  order_id text,
  capture_id text,
  reason text not null,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  paypal_status text not null,
  paypal_stage text,
  item_name text,
  buyer_name text,
  seller_name text,
  is_replay boolean not null default false,       -- a finished case shown as a replay
  agreed_option text,                              -- option the buyer agreed to in Parley
  agreed_at timestamptz,
  agreed_fingerprint text,                         -- case-file fingerprint at the moment of agreement
  offer_amount numeric(10,2),                      -- last offer the seller sent through Parley
  outcome jsonb,                                   -- PayPal's dispute_outcome once resolved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence (
  case_id uuid not null references cases(id) on delete cascade,
  id text not null,                                -- E1, E2, ...
  source text not null check (source in ('paypal','buyer','seller')),
  kind text not null,                              -- order | payment | tracking | message | photo | note
  title text not null,
  body text,                                       -- text content; for photos, the AI description
  file_path text,                                  -- path in the evidence bucket, for uploads
  sha256 text not null,                            -- fingerprint of the content
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (case_id, id)
);

create table if not exists claims (
  case_id uuid not null references cases(id) on delete cascade,
  id text not null,                                -- C1, C2, ...
  party text not null check (party in ('buyer','seller')),
  body text not null,
  primary key (case_id, id)
);

create table if not exists claim_links (
  case_id uuid not null references cases(id) on delete cascade,
  claim_id text not null,
  evidence_id text not null,
  relation text not null check (relation in ('supports','contradicts')),
  quote text,
  quote_kind text not null default 'text' check (quote_kind in ('text','photo_description')),
  primary key (case_id, claim_id, evidence_id)
);

create table if not exists policy_checks (
  case_id uuid primary key references cases(id) on delete cascade,
  rule_ids text[] not null default '{}',
  implication text not null,
  evidence_ids text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  summary text,                                    -- neutral summary for both sides
  options jsonb not null default '[]',             -- priced settlement options
  evidence_fingerprint text not null,              -- recompute when the evidence changes
  model text,
  created_at timestamptz not null default now()
);

-- Added on 10 Nov (Level 6): what kind of complaint it is, and what the checker did to the AI's answer.
alter table policy_checks add column if not exists complaint_type text;
alter table policy_checks add column if not exists checker jsonb;

-- The app talks to the database only with the service-role key, from the server.
-- Row level security with no policies blocks every other kind of access.
alter table cases enable row level security;
alter table evidence enable row level security;
alter table claims enable row level security;
alter table claim_links enable row level security;
alter table policy_checks enable row level security;

-- Private bucket for uploaded evidence photos.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;
