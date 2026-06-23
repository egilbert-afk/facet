# Facet — Product Strategy

## Positioning

**Name:** Facet *(working title — final name TBD)*

**Tagline:** Every piece has a story. Keep it.

**One-sentence description:** Facet keeps the story behind every piece of jewelry you own, so it's never lost to memory.

**The problem:** The meaning behind a piece of jewelry — who gave it, when, why, what it meant — usually lives in one person's memory alone. It's never written down anywhere. When that person forgets a detail, or isn't around to ask, the story disappears, even though the object remains.

**The solution:** A simple, low-friction catalog built around sentiment first — capture the story while it's known, find any piece instantly by photographing it, and eventually pass the whole collection's history to the next generation.

---

## Target user

Someone with a meaningful jewelry collection — heirloom pieces from relatives, gifts marking occasions, a mix of sentimental and everyday items — who has no current system for tracking what they have or why it matters. Starting from zero, building the catalog gradually over weeks rather than all at once.

The household is the access unit, consistent with the technical model, even though the first real use case is a single person.

---

## Why this approach (lessons carried from a prior project)

This isn't the first product attempt — a prior project (a household recipe app) went from a personal tool to a real, evolving product with real users and real lessons. Several of those lessons shape this product's foundation directly:

- **Multi-tenancy from day one, not retrofitted.** Adding households after months of single-user data required a careful migration. This time, the household model exists before the first real item is ever added.
- **Capture behavioral data before the feature that uses it is built.** A prior project's `cook_sessions` table existed before any cook-history UI did, and that early data became valuable once the UI finally arrived. The camera-lookup feature here follows the same instinct — every lookup attempt is logged from day one, regardless of whether a single analytics view exists yet.
- **Ship the minimum lovable version first, refine from real usage.** A prior project's most interesting features (a "Made it" signal, voice-guided cooking) came directly from watching real beta behavior, not from upfront guessing. The camera-matching feature here is explicitly scoped as "narrow to a few good candidates," not "guaranteed exact match" — an honest target that can improve over time with real data, rather than an overpromise that has to be walked back.

---

## What "useful" means here — success criteria before scale

Before any thought of other users or monetization, this product succeeds if:

1. The primary user adds pieces gradually, without the app ever feeling like a chore
2. The camera-lookup feature, even in its early "few candidates" form, feels like a genuine shortcut compared to scrolling a list
3. At least a few stories get captured that would otherwise have stayed unwritten
4. The primary user would, unprompted, want to show this to her daughter

If those four things are true, the foundation is sound regardless of whether this ever becomes a product for other households.

---

## Business model (exploratory — not the day-one focus)

Unlike a prior project, this one's productization path is intentionally not the first priority. Sentiment and genuine usefulness to one real person come first. The schema and auth model are built so a path to "more households" exists later without rework — but pricing, tiers, and distribution are deliberately undecided until the core experience is proven.

If pursued later, likely shape based on prior product learnings:

- Household as the billing unit (same pattern as before)
- A generous free tier — the full sentiment-capture experience, possibly capped by item count
- A paid tier unlocking practical features — appraisal document storage, multi-household sharing, advanced camera-matching
- Graduated, grandfathered pricing for early adopters, consistent with the philosophy used previously

Deliberately not decided yet: specific price points, free tier limits, distribution strategy (PWA vs. App Store). These get revisited once the core experience has been used and trusted by the first real household.

---

## The camera-lookup feature — the most novel part of this product

**The vision:** see a piece of jewelry, photograph it, and immediately get the story — without scrolling, without remembering what you named it.

**The honest technical target:** true single-exact-match recognition is a hard problem even for well-resourced products — two similar rings can look nearly identical to a model without a clean reference photo and consistent lighting. The realistic and still valuable target is a short, accurate list of candidates (photo + headline) that the user taps to confirm. This is treated as the real design goal, not a fallback.

**Why multiple reference photos per item matter:** a single reference photo captures one angle and one lighting condition. The photo taken in the moment of lookup is unpredictable. Multiple reference angles per item — including close-ups of distinguishing features like engravings — meaningfully improve match quality over a single photo.

**Why every attempt is logged from day one:** matching quality is something to measure and improve over time, not something to get right once and forget. The `lookup_attempts` table (candidates shown, what was selected, whether the top candidate was correct) exists before any dashboard does, so when it's time to improve the matching prompt or approach, real usage data is already there — same instinct as a prior project's early behavioral-data tables.

---

## The flexible data model — built for what comes next

Items store category-specific details as flexible attribute rows rather than rigid columns. This is a deliberate bet: the same underlying structure (an item, its photos, its attributes, its story) should be able to support a completely different domain — a family heirloom archive spanning photographs, letters, scrapbooks, and household objects — without restructuring the database.

The cost of this decision is a slightly more abstract Layer 1 than a simpler "just add jewelry columns" approach would be. The benefit is that "version this into something bigger" is a fork-and-relabel exercise rather than a rewrite, if and when that's the right next step.

---

## Product-led growth hypotheses

Not the current focus — revisit once the core experience has been used and trusted by the first real household. Captured here so they're not lost.

**Why this product's growth mechanics differ from a recipe app**

A recipe app's value is mostly private and habitual — you cook alone or with your household, and sharing a recipe is a single transactional moment. Facet's value is emotional and inherently relational — the entire point of cataloguing a piece is that there's a person on the other end of the story (who gave it, who it's being preserved for). That relational structure is a stronger foundation for PLG than a recipe app has, if the right hooks are built in.

**Hypothesis 1 — The "tell me the story" share is a natural viral loop**

When a user shows someone a piece and says "let me show you what Facet says about this," she's not promoting an app, she's sharing something personal. A clean, beautiful single-item share view (similar to a recipe app's public `/r/[token]` page) means each shared story is a tiny, low-pressure exposure to the product with zero marketing voice. Shareable individual item pages, framed as "here's the story behind this piece," will get forwarded inside families without feeling like growth-hacking. Most actionable near-term: make sure the single-item view is something genuinely nice to look at and easy to share — worth doing for its own sake, and this falls out of it for free.

**Hypothesis 2 — Gifting and inheritance are natural multi-user trigger events**

Jewelry literally changes hands between people at specific life moments — births, graduations, deaths, weddings. Each is a natural "invite a second user" trigger: "Mom, can you add the story of this ring before you give it to me?" A lightweight "transfer this item" flow that prompts the story to be filled in at the moment of gifting would naturally pull a second household member or relative into the app. Structurally similar to how a wedding registry spreads — the gift-giving moment is the growth moment.

**Hypothesis 3 — Seasonal windows as natural acquisition moments**

Sentiment-driven products have real seasonality that can be ridden rather than fought. Interest in cataloguing jewelry likely spikes around Mother's Day, the holidays, and graduation season — because those are when people are actively thinking about heirlooms, gifts, and what they want to pass down. A small, low-effort push timed to one of these windows could outperform the same effort at a random time of year.

**Hypothesis 4 — The camera-lookup feature is the "aha" moment; onboarding should rush toward it**

For a recipe app, the "aha" moment is slow — you have to import a bunch of recipes before it feels valuable. For Facet, camera-lookup can deliver delight almost immediately — even with just 5–10 items cataloged, "point your phone at a piece and see its story" is a magic moment. Retention and word-of-mouth will likely correlate strongly with how fast a new user gets from signup to their first successful camera-lookup, more than with total catalog size. Worth instrumenting this specifically (time-to-first-lookup), the same way `lookup_attempts` tracks matching quality.

**Hypothesis 5 — The "user" and the "person who benefits" can be different people**

A daughter benefits from this app without ever opening it herself, at least not yet. That's unusual. A "family view" or "legacy export" feature — something a non-using family member could receive as a PDF or shared link without ever signing up — could be a meaningful secondary growth surface. It lets the value travel to people who aren't direct users yet, and some of them will eventually want to start their own catalog.

---

## Messaging (to develop)

Not yet developed — will be shaped by what the primary user says, unprompted, once she's actually used it for a while. Key question to revisit: what does she say when describing this to someone else?

---

## Name and brand

**Working name:** Facet
**Status:** Not finalized — placeholder until the product is proven with its first real user.
**Decision timing:** Revisit naming once sentiment-first usage is validated, consistent with how naming was sequenced on a prior project.
