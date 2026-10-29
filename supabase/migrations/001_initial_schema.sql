-- FairySplit initial schema — mirrors localStorage shapes in src/lib/*.ts
-- Run in Supabase Dashboard → SQL Editor (or supabase db push if using CLI).

-- Profiles (see profile.ts)
CREATE TABLE IF NOT EXISTS public.profiles (
  wallet_address text PRIMARY KEY CHECK (wallet_address = lower(wallet_address)),
  display_name text,
  email text,
  email_reminders_opt_in boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Friends (see friends.ts)
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL CHECK (owner_address = lower(owner_address)),
  friend_address text NOT NULL CHECK (friend_address = lower(friend_address)),
  nickname text NOT NULL,
  friend_email text,
  created_at_ms bigint NOT NULL,
  UNIQUE (owner_address, friend_address)
);

CREATE INDEX IF NOT EXISTS friends_owner_idx ON public.friends (owner_address);

-- Activity (see activity.ts)
CREATE TABLE IF NOT EXISTS public.activity_items (
  id text PRIMARY KEY,
  wallet_address text NOT NULL CHECK (wallet_address = lower(wallet_address)),
  type text NOT NULL,
  title text NOT NULL,
  details text,
  chain_id bigint,
  tx_hash text,
  bill_id text,
  timestamp_ms bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_wallet_idx ON public.activity_items (wallet_address);
CREATE INDEX IF NOT EXISTS activity_wallet_time_idx ON public.activity_items (wallet_address, timestamp_ms DESC);

-- Split requests (see requests.ts)
CREATE TABLE IF NOT EXISTS public.split_requests (
  id text PRIMARY KEY,
  chain_id bigint NOT NULL,
  bill_id text NOT NULL,
  split_name text NOT NULL,
  creator_address text NOT NULL CHECK (creator_address = lower(creator_address)),
  participant_address text NOT NULL CHECK (participant_address = lower(participant_address)),
  amount_usdc text,
  token_address text,
  token_symbol text,
  is_confidential boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  created_at_ms bigint NOT NULL,
  paid_at_ms bigint
);

CREATE INDEX IF NOT EXISTS split_requests_participant_idx ON public.split_requests (participant_address);
CREATE INDEX IF NOT EXISTS split_requests_creator_idx ON public.split_requests (creator_address);

-- Notifications (see notifications.ts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  user_address text NOT NULL CHECK (user_address = lower(user_address)),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  related_chain_id bigint,
  related_bill_id text,
  created_at_ms bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_address);
CREATE INDEX IF NOT EXISTS notifications_user_time_idx ON public.notifications (user_address, created_at_ms DESC);

-- Row Level Security: enabled; no policies yet — anon/auth cannot read/write.
-- Service role (server-only) bypasses RLS for API routes until you add Supabase Auth + policies.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Optional: keep updated_at fresh on profiles
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_profiles_updated_at();
