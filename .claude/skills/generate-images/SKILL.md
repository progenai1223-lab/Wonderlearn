---
name: generate-images
description: >-
  Generate a consistent set of website images from a shot list with Google Gemini (Nano Banana,
  scripts/gemini.mjs; Gamma as a fallback), and turn them into web-ready WebP files
  with a manifest the website-generator agent can build from. Use when a site needs images the
  client hasn't supplied and the user wants them generated, or when the image-generator agent runs.
---

# generate-images

Turns a **shot list** into finished, optimised image files for one site in `sites/<slug>/`.

## Inputs

- `sites/<slug>/images/shotlist.md`: one entry per image with its id (kebab-case), its role (`hero`
  or `image`), its aspect (`banner` 16:9, `social-portrait` 4:5, `social-square` 1:1, `story` 9:16),
  the section it serves, and what it shows.
- A **style line** at the top of the shot list. Every prompt repeats it word for word, so the set
  reads as one hand.

## Prompt rules

Each prompt is: the subject in one concrete sentence (who, doing what, with what, where), then the
style line, then the fixed tail below.

- **Fixed tail:** `No text, no letters, no numbers, no logos, no watermark, no signage, no captions.
  Uncluttered composition with calm space around the subject.` Every word on the page is live text
  (design-taste-frontend), so an image never carries any.
- **The real subject, never mood.** Show the actual activity or material: a child working a
  reasoning puzzle, a tutor beside a small group, a practice paper, never clouds, lightbulbs, rockets
  or abstract "success".
- **People:** when the style is illustration, children and adults may appear as clearly illustrated
  figures, never photorealistic, and never a real or recognisable person. When the style is photo,
  keep faces out of frame (hands, backs, materials) and list every image as a stand-in.
- **Respect the design skill:** no violet or lavender as a dominant colour; no gradients, grain or
  glow standing in for a subject.
- Gemini takes no style `type`, so the prompt itself says "illustration" (the style line does).
  Aspects map as: `banner` → `16:9`, `social-portrait` → `4:5`, `social-square` → `1:1`, `story` → `9:16`.

## The API key

Gemini's key is stored encrypted with Windows DPAPI at `%LOCALAPPDATA%\website-generator\gemini.key`,
outside the project. The user stores it themselves:
`powershell -ExecutionPolicy Bypass -File .claude/skills/generate-images/scripts/store-gemini-key.ps1`
(a hidden prompt). `GEMINI_API_KEY`, when set, takes precedence. Never read, print, echo, log or copy
the key, and never ask the user to paste it into the chat. `node .claude/skills/generate-images/scripts/gemini.mjs --check`
confirms that a key is available without showing it. With no key, stop and tell the user to run the
store script.

## Steps

1. **Generate (Gemini, the default):** write `sites/<slug>/images/jobs.json`, an array of
   `{ "id", "prompt", "aspect" }` (the full prompt and the mapped aspect ratio), then run from the
   project root:
   `node .claude/skills/generate-images/scripts/gemini.mjs sites/<slug>/images/jobs.json sites/<slug>/images/raw`.
   It writes `raw/<id>.jpg` and prints one JSON line per job (`ok`, `file`, or `error`). The model
   defaults to `gemini-nano-banana-2.1` (`--model` overrides it; `gemini-3-pro-image` is the higher
   quality option). For retries, write a jobs file with only those shots. A job that fails on quota or
   billing is reported, not retried in a loop.
2. **Fallback (Gamma):** only when the user asks for it, call `mcp__claude_ai_Gamma__generate_image`
   once per shot (`type`, `sizePreset`, no `themeId`), poll `get_image_generation_status` until
   `completed` (never call generate again to check progress), and download with
   `curl -sSL --fail -o sites/<slug>/images/raw/<id>.<ext> "<url>"`.
3. **Look at every image** with the Read tool, at full size. Reject it and generate once more with a
   corrected prompt if it has any text or letter-like marks, malformed hands or faces, a dominant
   violet, a muddled subject, or a style that doesn't match the set. Two retries per shot at most;
   after that, keep the best one and note the fault in the manifest.
4. **Optimise:** from the project root, run
   `node .claude/skills/generate-images/scripts/optimise.mjs sites/<slug>/images/raw/<file> sites/<slug>/assets/img <id> --role <hero|image>`.
   It writes `<id>-<width>.webp` files (hero 2880/1440/780, others 1600/1200/780, never upscaled),
   each within the budget (hero 400 KiB, others 250 KiB), and prints a JSON line. A file marked
   `"overBudget": true` is deleted and left out of the manifest; the smaller widths serve.
5. **Manifest:** write `sites/<slug>/images/manifest.json`, an array with one object per image:
   `id`, `section`, `role`, `aspect` (from the JSON line), `files` (from the JSON line), `alt` (one
   plain sentence of what it shows, no "image of"), `subject`, `prompt`, `type`, `source: "generated"`
   and `notes`.

## How the site uses them

The website-generator marks every generated image with `data-source="illustration"` (or
`data-source="stand-in"` when it is photo style) and `data-subject`, sets `srcset` from the files,
and adds `width`/`height`. Its report lists every image as generated, to be replaced or kept by the
client. A generated image never carries a caption or a credit.
