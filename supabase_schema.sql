-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- before deploying, so the tables exist for the API functions to write to.

create table if not exists contact_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text default 'get_in_touch_form',
  created_at timestamptz default now()
);

create table if not exists employer_signups (
  id uuid primary key default gen_random_uuid(),
  organisation text,
  contact_name text,
  email text,
  phone text,
  password text,
  region text,
  created_at timestamptz default now()
);

create table if not exists worker_signups (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  facility text,
  skills text[],
  pin text,
  created_at timestamptz default now()
);

-- Row Level Security: block all public access. The API functions use the
-- service role key, which bypasses RLS, so this just prevents anyone from
-- reading/writing these tables directly from the browser with the anon key.
alter table contact_leads enable row level security;
alter table employer_signups enable row level security;
alter table worker_signups enable row level security;
