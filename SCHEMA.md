# Database Schema — Facet

## Layer 1 Blueprint

This document defines the full database schema. Read it completely before writing any migration files.

This schema is informed directly by patterns proven in a prior project (Mise, a recipe app) — including a real bug (RLS infinite recursion) that was hit and fixed there. This document encodes the fix as a starting rule rather than something to discover again.

---

## Design principles

- **Multi-tenant from day one.** Every item belongs to a household, not a user. This app may eventually serve multiple households as a real product — the schema is built for that from the first migration, even though the first real household has one user.
- **Flexible attributes, not rigid columns.** Item-specific details (metal type, gemstone, carat) are stored as rows in an `item_attributes` table, not as hardcoded columns on `items`. This is what allows this same schema to be forked into a general heirloom archive later without a rewrite — different item categories just define different attribute sets.
- **Multiple photos per item, one designated primary.** Reference photos live in their own table, not a single column.
- **RLS from the first migration, using a SECURITY DEFINER helper function** — never a self-referential subquery. A prior project hit infinite recursion by writing a household-membership policy that queried its own table inside itself. This schema avoids that by using a helper function from the start.
- **Capture behavioral data before the UI that uses it exists.** The camera-lookup feature is the most novel part of this app and the hardest to get right. A lightweight events table captures every lookup attempt and outcome from day one, even before any analytics view is built — so when it's time to improve matching, real usage data already exists.
- **`household_id` is NOT NULL from the first migration.** Unlike a retrofit project with existing data to backfill, this app starts fresh — there's no migration dance required.

---

## Tables

### `households`

The billing and access unit. Carried forward directly from a prior project's proven pattern.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| name | text NOT NULL | e.g. "Gilbert Household" |
| invite_code | text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)) | Shareable code for inviting members |
| is_beta | boolean NOT NULL DEFAULT false | Bypasses any future plan limits |
| plan | text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')) | |
| stripe_customer_id | text UNIQUE | Dormant until billing exists — column present from day one |
| stripe_subscription_id | text UNIQUE | Dormant until billing exists |
| grandfathered_price | decimal(10,2) | Locked-in price at signup, if/when pricing launches |
| subscribed_at | timestamptz | |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

---

### `household_members`

Join table connecting users to households. One user belongs to exactly one household (enforced by the unique constraint, not just application logic).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| household_id | uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE | |
| user_id | uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE | |
| role | text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')) | |
| invited_by | uuid REFERENCES auth.users(id) | Nullable — the founding owner has no inviter |
| joined_at | timestamptz NOT NULL DEFAULT now() | |

**Constraint:** `UNIQUE (household_id, user_id)` — enforces one household per user at the database level.

**Index on:** `user_id` (used by the RLS helper function below)

---

### `items`

One row per jewelry piece.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| household_id | uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE | |
| created_by | uuid NOT NULL REFERENCES auth.users(id) | |
| name | text NOT NULL | e.g. "Grandma's sapphire ring" |
| category | text NOT NULL | Enum: ring, necklace, bracelet, earrings, brooch, watch, other |
| given_by | text | Free text — who gave it, or whose it was |
| headline | text | One-line story, shown in camera-match candidates |
| story | text | Longer color/detail — written with an eye toward a future reader (e.g. a daughter) |
| acquired_era | text | Free text approximate timing — "1970s," "my 30th birthday" |
| estimated_value_cents | integer | Nullable — practical/insurance use, optional from day one |
| appraisal_doc_url | text | Nullable — link to stored appraisal document, future layer |
| is_archived | boolean NOT NULL DEFAULT false | Soft delete |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

**Index on:** `household_id`, `category`

---

### `item_attributes`

Flexible key-value detail rows per item. This is the design decision that lets this schema fork into a general heirloom archive later — heirlooms just use a different attribute vocabulary on the same structure.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| item_id | uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE | |
| attribute_name | text NOT NULL | e.g. metal, gemstone, carat_weight |
| attribute_value | text NOT NULL | e.g. white gold, sapphire, 1.2 |
| order_index | integer NOT NULL DEFAULT 0 | Display order |

**Index on:** `item_id`

**Suggested jewelry attribute vocabulary** (not enforced at the database level, just convention):
`metal`, `gemstone`, `carat_weight`, `setting_style`, `hallmark`, `ring_size`, `chain_length`

---

### `item_photos`

Multiple reference photos per item, one marked primary for grid display.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| item_id | uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE | |
| photo_url | text NOT NULL | Supabase Storage URL |
| is_primary | boolean NOT NULL DEFAULT false | The one shown in grid view; exactly one per item should be true |
| caption | text | e.g. "the engraving inside the band" |
| order_index | integer NOT NULL DEFAULT 0 | |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**Index on:** `item_id`

---

### `lookup_attempts`

Captures every camera-lookup attempt and its outcome — before any analytics UI exists to display this data. Same instinct as a prior project's `cook_sessions` table: the data is more valuable the earlier it starts accumulating.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| household_id | uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE | |
| attempted_by | uuid NOT NULL REFERENCES auth.users(id) | |
| candidate_item_ids | uuid[] | The ranked list of items returned as candidates |
| selected_item_id | uuid REFERENCES items(id) | Which one the user actually tapped, if any |
| was_correct_top_match | boolean | True if selected_item_id matches the first candidate |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**Index on:** `household_id`

**Why this matters:** once enough rows exist, you can measure how often the top candidate is actually the right one — the single most important quality metric for the camera feature — without having built any dashboard yet.

---

## Row Level Security

RLS is enabled from the first migration, not retrofitted later. This avoids ever having a broad "all authenticated users" policy that needs replacing.

### The helper function — write this before any policy

A prior project hit infinite recursion by writing a household-membership policy that queried `household_members` from inside a policy on `household_members` itself. The fix was a `SECURITY DEFINER` function that bypasses RLS for the membership lookup. Start with the fix already in place:

```sql
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1;
$$;
```

The `SET search_path = public` line is a security hardening detail — without it, a malicious search path could trick the function into resolving `household_members` against the wrong schema. Include it from the start.

### Policy pattern — every household-scoped table uses this shape

```sql
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_items_access" ON items
  FOR ALL TO authenticated
  USING (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());
```

Apply this same pattern to `items`, `lookup_attempts`. For child tables (`item_attributes`, `item_photos`), scope through the parent:

```sql
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
```

`household_members` itself uses the helper function too, for the same reason it was originally needed:

```sql
CREATE POLICY "household_members_read" ON household_members
  FOR SELECT TO authenticated
  USING (household_id = get_my_household_id());
```

**Rule going forward:** if a new table needs a household-scoped policy, it calls `get_my_household_id()`. It never writes a fresh `SELECT household_id FROM household_members WHERE user_id = auth.uid()` subquery directly in a policy. That subquery is exactly what caused the recursion the first time.

---

## Migration file structure

```
supabase/migrations/
├── 00001_create_households.sql
├── 00002_create_household_members.sql
├── 00003_create_get_my_household_id_function.sql
├── 00004_create_items.sql
├── 00005_create_item_attributes.sql
├── 00006_create_item_photos.sql
├── 00007_create_lookup_attempts.sql
└── 00008_enable_rls.sql
```

The helper function gets its own migration file (`00003`) and runs before any RLS policy references it — functions must exist before policies can call them.

Unlike a retrofit project, there's no seed/backfill migration needed — `household_id` is NOT NULL from the first items migration, since there's no pre-existing data without it.

---

## What Layer 1 delivers

When Layer 1 is complete and all tests pass, you should be able to:

1. Create a household and become its owner on signup
2. Create an item with a name, category, and at least one attribute row
3. Add multiple photos to an item, with exactly one marked primary
4. Confirm RLS — a second test household cannot see the first household's items, even via direct query
5. Confirm the `get_my_household_id()` pattern works without recursion under real query load
6. All tests pass

Layer 2 (the camera-lookup matching feature) does not begin until this is confirmed working.
