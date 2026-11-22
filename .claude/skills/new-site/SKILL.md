---
name: new-site
description: >-
  Start a new generated website: collect the brief from the user, save it as sites/<slug>/brief.md,
  and hand it to the website-generator agent, which builds the landing page and sub-pages with the
  design-taste-frontend skill. Use when the user types /new-site or asks to generate, create or start
  a new website or landing page for a business, product, place or app.
argument-hint: "[business name or a one-paragraph brief]"
---

# /new-site

You collect the brief here, because the user can answer questions in this session. The
`website-generator` agent can't ask questions, so the brief you hand it must be complete enough
to build from.

## 1. Gather the brief

Start from what the user already gave (the arguments, earlier messages, attached files). Fill in
`templates/brief.md`. Ask only for what is missing **and** would change the build, in a single
AskUserQuestion call of at most four questions. These matter most:

1. **What is sold and to whom.** This sets the kind: software, gaming, tech hardware, product,
   service or place.
2. **The one main action** (Book a room, Order a cake, Start a free trial, Get directions).
3. **Pages beyond the landing page.** Offer: landing page only (recommended for a first build),
   plus About and Contact, plus Pricing, or custom.
4. **Real material:** logo, colours, photographs, screenshots, prices, address, hours. Say
   plainly that without photographs the build uses licensed stand-ins, which are listed for
   replacement.

Never ask for things the skill decides by dealing (palette, fonts, hero layout, effects). Leave
anything the brief doesn't settle to the agent's defaults.

## 2. Save it

- Choose a slug from the business name (lowercase, hyphens, e.g. `harbour-bakery`). If
  `sites/<slug>/` already exists, ask whether to rebuild it or use a new slug.
- Write `sites/<slug>/brief.md` from the template, filled in. Copy any files the user attached
  (logo, photographs) into `sites/<slug>/client/`, keeping their filenames, and list them in the
  brief.

## 3. Images (when the user wants them generated)

Write `sites/<slug>/images/shotlist.md` (a style line, then one row per image: id, role, aspect,
type, section, subject), covering the sections a page of this kind needs. A place needs 8 to 14
images; another kind needs 4 to 8. Recommend illustration style over photorealistic for anything
with people. Launch the `image-generator` agent with the slug and the shot-list path, wait for it to
finish, and check that `images/manifest.json` exists before step 4.

## 4. Build

Launch the `website-generator` agent with the Agent tool:

- `subagent_type`: `website-generator`
- `description`: `Build <business name> website`
- `prompt`: the slug, the path `sites/<slug>/brief.md`, and one line saying the brief is final and
  every open point should take the skill's default and be listed as assumed.

Tell the user it's running, and that a full build with its browser checks usually takes a while.

## 5. Relay the result

When the agent finishes, give the user:

- the `GATE:` line and any open FAILs, unchanged
- the pages built, and how to open them (`sites/<slug>/index.html`)
- the deal in one line (palette, fonts, hero)
- what the client still needs to supply (photographs, assumed facts to confirm, domain)

Keep it short. The full report stays available if they ask.
