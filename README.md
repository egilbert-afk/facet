# Jewelry Box

A sentiment-first catalog for a jewelry collection — what each piece is, who gave it, and the story behind it — built so the people who matter (a daughter, a future generation) don't lose what only one person currently remembers.

Built with multi-tenancy and a flexible item model from day one, so the same foundation can later support a general family heirloom archive (photos, letters, household objects) without a rewrite.

---

## The problems this solves

**The fading memory problem** — the story behind a piece of jewelry usually lives in one person's head. When that person forgets a detail, or isn't there to ask anymore, the story is gone. Jewelry Box captures it while it's still known.

**The "what is this, again?" problem** — a camera-lookup feature lets you photograph a piece you're holding and get back a short list of likely matches from your own catalog, with photo and headline, so you can confirm which one it is and see the full story.

**The starting-from-zero problem** — partial entry is allowed everywhere. Add a piece with just a name and a story today; add the photo next week. Friction-free capture matters more than complete records on day one.

**The insurance/practical problem** — value estimates and appraisal documentation have a home in the data model from the start, even if sentiment is the priority on day one.

---

## Features

### Capturing items

- **Manual entry** — name, category, who gave it, headline story, longer detail
- **Partial entries allowed** — save now, add a photo later
- Multiple reference photos per item, one marked primary for grid display
- Flexible attributes per item (metal, gemstone, carat, etc.) — not hardcoded fields, so the model generalizes to other item types later

### Finding items

- Visual grid, browsable by category (rings, necklaces, bracelets...)
- Search by who gave the piece
- **Camera lookup** — photograph a piece, get back a ranked short list of likely matches (photo + headline), tap to confirm and see the full story

### Managing the collection

- Soft archive for pieces no longer in the collection
- CSV export — full catalog, useful for insurance conversations or as a portable backup

### Practical tracking

- Estimated value per item (optional)
- Appraisal document storage (future layer)

---

## Item categories

Ring · Necklace · Bracelet · Earrings · Brooch · Watch · Other

---

## Who uses it

| Role | Access |
|------|--------|
| Owner | Full access — add, edit, archive, export, manage household invite code |
| Member | Full access to items — add, edit, view, camera lookup |

Built as a household model from the start — designed so additional households (beyond one family) could be supported later without rework, even though the first real user is one person cataloging her own collection.

---

## Known issues

| Issue | Layer | Notes |
|-------|-------|-------|
| No confirmation before deleting an attribute — mis-tap permanently removes it | 3 | `AttributeSection.tsx` `handleDelete`. Add a confirmation step in a later polish pass. |
| Edit form in AttributeSection lacks Enter-to-save | 3 | Add form has `onKeyDown` Enter handler; edit form doesn't. Minor inconsistency. |
| Integration tests don't cover DB error paths for attribute PATCH/DELETE | 3 | No test for when the Supabase update/delete call itself errors. Consistent gap with the rest of the test suite. |
| `PhotoSection.tsx` delete silently ignores failure | 2 | If DELETE photo request fails, UI does nothing — no error shown. Same pattern fixed in `AttributeSection` in Layer 3. |
