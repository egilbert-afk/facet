-- SECURITY DEFINER bypasses RLS for the membership lookup, preventing the
-- infinite recursion that occurs when a household_members policy queries
-- household_members inside itself. SET search_path prevents schema injection.
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1;
$$;
