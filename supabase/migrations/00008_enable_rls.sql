-- Enable RLS on all tables and wire up household-scoped policies.
-- Every policy calls get_my_household_id() (defined in 00003) rather than
-- writing the subquery inline — the inline pattern caused recursion previously.

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_attempts ENABLE ROW LEVEL SECURITY;

-- households: any authenticated user can create one (signup flow); members can
-- read and update their own household; no DELETE policy (handled at app layer)
CREATE POLICY "household_insert" ON households
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "household_read" ON households
  FOR SELECT TO authenticated
  USING (id = get_my_household_id());

CREATE POLICY "household_update" ON households
  FOR UPDATE TO authenticated
  USING (id = get_my_household_id())
  WITH CHECK (id = get_my_household_id());

-- household_members: any authenticated user can insert (join via invite code or
-- create household); members can read all members of their own household
CREATE POLICY "household_members_insert" ON household_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "household_members_read" ON household_members
  FOR SELECT TO authenticated
  USING (household_id = get_my_household_id());

-- items: full CRUD scoped to the member's household
CREATE POLICY "household_items_access" ON items
  FOR ALL TO authenticated
  USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());

-- item_attributes: scoped through parent item
CREATE POLICY "household_item_attributes_access" ON item_attributes
  FOR ALL TO authenticated
  USING (
    item_id IN (
      SELECT id FROM items WHERE household_id = get_my_household_id()
    )
  )
  WITH CHECK (
    item_id IN (
      SELECT id FROM items WHERE household_id = get_my_household_id()
    )
  );

-- item_photos: scoped through parent item
CREATE POLICY "household_item_photos_access" ON item_photos
  FOR ALL TO authenticated
  USING (
    item_id IN (
      SELECT id FROM items WHERE household_id = get_my_household_id()
    )
  )
  WITH CHECK (
    item_id IN (
      SELECT id FROM items WHERE household_id = get_my_household_id()
    )
  );

-- lookup_attempts: full CRUD scoped to the member's household
CREATE POLICY "household_lookup_attempts_access" ON lookup_attempts
  FOR ALL TO authenticated
  USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());
