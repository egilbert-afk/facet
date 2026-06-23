CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  is_beta boolean NOT NULL DEFAULT false,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  grandfathered_price decimal(10,2),
  subscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
