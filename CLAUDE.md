# CLAUDE.md — Facet

This file guides Claude Code when working on this project. Read it fully before writing any code, and refer back to it whenever making architectural or workflow decisions.

This project carries forward proven conventions from a prior project (Mise, a recipe app) — including several rules that exist specifically because a mistake was made and fixed there. Where that's true, it's called out so the reasoning isn't lost.

---

## About the developer

I am a beginning coder. Please help ensure I am learning proper coding processes and nomenclature throughout. Explain your reasoning when making technical decisions, and flag when something is a best practice vs. a pragmatic shortcut. Do not optimize for speed at the expense of my learning.

---

## Core principles

- **Never commit code without me reviewing it** and going through the proper checkpoints — pull requests and me pushing from terminal.
- Commit messages must follow conventional commit naming (see below) and be properly descriptive.
- Keep commits small and focused — target under 400 lines of meaningful code per commit.
- Tests are built into each layer before moving to the next. Never skip or defer tests to move faster.
- Fix bugs as they appear. Do not accumulate debt and move on.
- Build one layer at a time. Each layer must be complete, tested, and merged before the next begins.

---

## Commit workflow

Follow these steps for every commit, in order:

1. `git diff` — review all changes before staging anything
2. Stage specific files by name — never use `git add .` or `git add -A`
3. Commit with a conventional commit message prefix:
   - `feat:` — new feature or capability
   - `fix:` — bug fix
   - `chore:` — setup, config, dependencies (no app logic)
   - `refactor:` — code restructure with no behavior change
   - `test:` — adding or updating tests
4. Run a code review on the staged diff — check for bugs, security issues, and maintainability concerns — fix before pushing
5. Push the branch to GitHub
6. Open a pull request on GitHub
7. Run `/review` on the PR — mandatory before merge
8. Fix any bugs or security issues before proceeding
9. Log non-urgent findings in the Known Issues table in README.md
10. **Ask: does anything from this PR warrant a new rule in CLAUDE.md?** A Known Issue being resolved, a bug that could repeat on future routes, a pattern that had to be corrected — these are candidates. If yes, add the rule before merging. Known Issues are things to fix later; CLAUDE.md rules are things to never repeat.
11. **Never say "ready to merge" before `/review` has been run**
12. Merge the PR on GitHub only after `/review` is complete and all findings addressed

---

## Commit size

- Target under 400 lines of meaningful code per commit
- `package-lock.json` is auto-generated and does not count toward the limit
- Split dependency installs into a separate `chore:` commit from the feature code that uses them
- If a commit is growing large, split it before staging — not after

---

## Branch naming

Branch names must match the commit prefix for that branch's work. Use kebab-case.

```
feat/description
fix/description
chore/description
refactor/description
test/description
```

Examples: `feat/item-capture`, `feat/camera-lookup`, `chore/supabase-setup`, `feat/multi-photo-upload`

---

## Testing

Every layer must include tests before moving to the next.

### TypeScript / Next.js

- **Framework:** Vitest — ESM-native, works well with Next.js
- Pure utility functions (matchers, formatters, fraction/value converters): unit tests
- API routes: integration tests
- Write tests in the same commit as the code they cover — never retroactively

### Bug-fixing order (TDD)

When fixing a bug, always:

1. Write a test that fails because of the bug — confirm it fails
2. Fix the code — confirm the test now passes
3. Commit the test and fix together

---

## Tech stack

| Layer | Tool | Notes |
|-------|------|-------|
| Frontend + API | Next.js 14+ with App Router, TypeScript | Mobile-first — primary use case is a phone in a bedroom/closet; server components by default, client components only when interactivity requires it |
| Database | PostgreSQL via Supabase | Use Supabase client library; no raw SQL strings in app code |
| Auth | Supabase Auth | Household model from day one — see Household Model below |
| AI | Claude API — claude-sonnet-4-6 | Camera-lookup matching, story formatting assistance |
| File storage | Supabase Storage | Item photos — multiple per item |
| Hosting | Vercel | Auto-deploys from GitHub main branch |
| Testing | Vitest | |

---

## Household model — built in from day one, not retrofitted

A prior project added households as Layer 9, after months of single-user data already existed, which required a careful nullable-column-then-backfill-then-NOT-NULL migration dance. This project starts with households from the very first migration, so that complexity never needs to exist here.

- **Unit of access:** The household. Items belong to a household, not an individual user.
- **Roles:** Owner and member. One owner per household — the billing contact, if billing is ever added. Owners can invite and remove members.
- **Membership:** One household per user, enforced via a `UNIQUE (household_id, user_id)` database constraint — not just application logic.
- **Joining:** Invite code only. Owner generates a code from household settings. Entering a code at signup joins that household. Signing up without a code creates a new household and makes the signer the owner.
- **Onboarding flow:** First login after account creation → if no household yet → create new household (owner) or enter invite code (member).

---

## Row Level Security — non-negotiable from the first migration

A prior project hit an infinite recursion bug by writing a household-membership RLS policy that queried its own table inside itself. The fix was a `SECURITY DEFINER` helper function. This project starts with that fix already in place — it is never optional and never deferred.

- Every household-scoped table has RLS enabled in the same migration that creates it. There is no "add RLS later" phase.
- Every household-scoped policy calls a shared `get_my_household_id()` helper function — never a direct `SELECT household_id FROM household_members WHERE user_id = auth.uid()` subquery written inline in a policy. That inline pattern is what caused the recursion previously.
- The helper function must include `SET search_path = public`. This is a security hardening detail, not optional boilerplate — without it, a malicious search path could resolve the table reference against the wrong schema.
- See SCHEMA.md for the exact function definition and policy pattern to use for every new table.

---

## Project-specific rules

### Never commit secrets

- `.env.local` is in `.gitignore` — never stage it
- All API keys go in environment variables only — never hardcoded

### Item data model — non-negotiable

Item-specific details (metal, gemstone, carat, etc.) are stored as rows in `item_attributes`, never as hardcoded columns on `items`. This is a deliberate design choice so the same schema can later support a general heirloom archive (different item types, different attributes) without a rewrite. Do not take shortcuts here even for early layers — do not add a `metal_type` column to `items` "just for now."

**Attribute entry UI — suggested, not required.** When adding or editing an item, offer the suggested jewelry attribute names from SCHEMA.md (metal, gemstone, carat_weight, setting_style, hallmark, ring_size, chain_length) as quick-add buttons or a dropdown of common names — but always allow a freeform attribute name as well. The suggestions exist to speed up entry, not to constrain it. Never validate or restrict `attribute_name` to a fixed enum at the API or database level.

Photos are stored as rows in `item_photos`, never as a single column on `items`. An item may have zero, one, or several reference photos. Exactly one should be marked `is_primary` for grid display — enforce this in application logic when saving (unset any other primary on the same item before setting a new one).

### Partial entry is allowed

Items can be saved with details only, no photo yet. Do not require a photo to save — the capture flow happens gradually over weeks, and requiring a photo upfront would create friction that stops the user from starting. A photo can be added later via edit.

### Claude API usage

- All Claude API calls go through a single dedicated API route per use case (e.g. `app/api/match/` for camera lookups) — never scattered through the codebase
- Always validate Claude's response structure before writing to the database or acting on it
- If Claude returns a malformed or ambiguous response, surface a clear fallback to the user (e.g. "couldn't narrow this down — browse by type instead") — never silently fail or guess

### Camera-lookup matching

- The matching flow returns a ranked list of candidates, not a single forced exact match. Exact-match-only is not the design target — narrowing to a short, accurate candidate list is.
- Each lookup attempt is logged to `lookup_attempts` (candidates returned, which one was selected, whether the top candidate was correct) before any UI exists to analyze this data. This mirrors a proven pattern from a prior project (`cook_sessions`) — the data is most valuable if it starts accumulating from day one, not once enough usage seems to justify building analytics.
- Candidate display shows photo + headline only, not the full story — full story is shown after the user confirms which item it is.

### CSV export

- Export pulls from the same household-scoped, RLS-protected query path the UI uses — never a separate unscoped query "for efficiency."
- Generate the CSV server-side; do not expose a raw data dump endpoint.

### Auth and roles

- Two roles: owner and member
- Any member can add, edit, and view items
- Only the owner can manage household settings (regenerate invite code, remove members) — same pattern as the household model above

### Shared auth helper — build this in Layer 1, not later

A prior project duplicated its `getUser()` + membership lookup across five separate routes before consolidating it into a shared helper. Avoid repeating that here: write `getAuthenticatedMembership()` (or equivalent) once, in Layer 1, and have every API route that needs household context call it from the start.

### Rate limiting

Any endpoint that accepts an invite code (join-household flow) must have basic rate limiting from the layer it's introduced in — not added later "before public launch." This was flagged as a deferred risk in a prior project; here it's a Layer 1 requirement instead of a known issue.

### Side effects and analytics

Any fire-and-forget logging (lookup attempt logging, future analytics events) must never be awaited in a response path. Awaiting them adds a database round-trip before every response.

```ts
// Correct — fire and forget:
logLookupAttempt(...).catch(err => console.error('[route] lookup log failed:', err))

// Wrong — blocks the response:
await logLookupAttempt(...)
```

---

## Layer build plan

Build strictly in this order. Do not begin a new layer until the current layer has passing tests and a merged PR.

| Layer | Status | What gets built |
|-------|--------|----------------|
| 1 | ✅ | Database schema (households, members, RLS with helper function from the start) + manual item entry, partial entries allowed |
| 2 | ✅ | Multi-photo upload per item, primary photo designation |
| 3 | — | Item attributes UI — add/edit flexible attribute rows per item, with suggested attribute names (metal, gemstone, etc.) as quick-add prompts |
| 4 | — | Browse and search — by category, by given_by, visual grid |
| 5 | — | Camera-lookup matching — Claude-based candidate narrowing, lookup_attempts logging |
| 6 | — | CSV export |
| 7 | — | Supabase auth — household creation, invite codes, onboarding flow |
| 8 | — | Practical fields — estimated value, appraisal document upload |

---

## Known issues

| Issue | Layer | Notes |
|-------|-------|-------|
| `middleware.ts` file convention deprecated in Next.js 16 — should be renamed to `proxy.ts` | 7 | Build warning: "middleware file convention is deprecated, use proxy instead." Fix before wiring auth in Layer 7. |
