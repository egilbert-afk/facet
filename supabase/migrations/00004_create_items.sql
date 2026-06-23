CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('ring', 'necklace', 'bracelet', 'earrings', 'brooch', 'watch', 'other')),
  given_by text,
  headline text,
  story text,
  acquired_era text,
  estimated_value_cents integer,
  appraisal_doc_url text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX items_household_id_idx ON items (household_id);
CREATE INDEX items_category_idx ON items (category);
