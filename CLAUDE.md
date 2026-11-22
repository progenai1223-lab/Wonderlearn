# Website generator

This project generates complete websites (a landing page plus optional sub-pages) for any kind of
business, using the **design-taste-frontend** (tasteskill 2.5) skill.

## Layout

- `.claude/skills/design-taste-frontend/`: the design skill: rules, references, asset kit, deal
  scripts and the finish gate. Treat it as read-only.
- `.claude/agents/website-generator.md`: the agent that builds one site from one brief.
- `.claude/skills/new-site/`: the `/new-site` entry point. It collects the brief and launches the agent.
- `.claude/skills/generate-images/` + `.claude/agents/image-generator.md`: generate a site's images
  from `sites/<slug>/images/shotlist.md` with Google Gemini Nano Banana (`scripts/gemini.mjs`; the
  key is DPAPI-encrypted in `%LOCALAPPDATA%\website-generator\gemini.key` via
  `scripts/store-gemini-key.ps1`; never read or print it), optimise them to WebP
  (`scripts/optimise.mjs`, uses the locally installed `sharp`) and write `images/manifest.json`.
  Run it before the website-generator, because subagents can't launch other subagents.
- `templates/brief.md`: the brief template.
- `sites/<slug>/`: one folder per generated site (`brief.md`, `index.html`, sub-pages, `assets/`,
  `.taste-skill/`).

## Working rules

- Build every new site through `/new-site` or the `website-generator` agent, never by hand outside
  `sites/<slug>/`. The gate's Stop hook only finds builds up to two folders below the project root.
- Run skill scripts from inside the site folder. Browser checks use the skill's own scripts with
  headless Edge or Chrome, one at a time, in the foreground.
- Requirements: Node 22+ (installed: 24), Chrome, Edge or Chromium (Edge is installed); ffmpeg is
  optional.
- To update the skill:
  `npx skills use "https://github.com/leonxlnx/taste-skill" --skill "design-taste-frontend"`, then
  replace `.claude/skills/design-taste-frontend` with the downloaded folder it prints.
