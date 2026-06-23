CREATE TABLE lookup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  attempted_by uuid NOT NULL REFERENCES auth.users(id),
  candidate_item_ids uuid[],
  selected_item_id uuid REFERENCES items(id),
  was_correct_top_match boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lookup_attempts_household_id_idx ON lookup_attempts (household_id);
