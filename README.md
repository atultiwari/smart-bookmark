![CI](https://github.com/atultiwari/smart-bookmark/actions/workflows/ci.yml/badge.svg)

# Smart Bookmark — v2 (Chrome MV3)

Smart Bookmark keeps research tabs under control: every save deduplicates against a canonical URL, asks Gemini for a concise summary + classification, and files the link by category, subcategory, and tags. The custom new-tab dashboard surfaces everything with powerful filters and saved views, while the popup lets you tweak AI suggestions before committing.

## Highlights
- **Strict de-duplication** – Canonicalize URLs (strip `utm_*`, fragments, default ports) and hash before saving; duplicates are surfaced for editing rather than re-added.
- **AI-assisted capture** – Gemini proposes summary, category, subcategory, tags, and rationale. No key? Heuristics fall back to your preferred interests and presets.
- **Structured knowledge base** – Schema v2 stores categories, subcategories, tag index, and saved filter views for rapid recall.
- **Dashboard control** – Grid/list toggle, text search, contextual subcategory chips, AND tag filters, domain and date range filters, saved views, and quick actions (open/delete/edit).
- **Polished popup** – Inline edits for title/summary/category/tags with autocompletion, duplicate indicator, and “apply suggestion” button.
- **Configurable options** – Manage Gemini key, interests, tag & subcategory presets, import/export, data reset, and new-tab override preference.

## Project layout
```
manifest.json
css/                 # Shared styles for popup/newtab/options
pages/               # HTML entry points copied to dist/
icons/               # Extension icons (16/32/48/128)
src/
  background/        # MV3 service worker (dedupe + Gemini pipeline)
  common/            # Message contracts shared with popup/newtab
  lib/               # Canonical URL util, storage/migration, heuristics, filters, LLM client
  newtab/            # Dashboard runtime (filters, cards, saved views)
  options/           # Settings page logic
  popup/             # Popup editor runtime
  tests/             # Lightweight Node test harness
tools/               # Build script
```

See `docs/architecture.md` for a deeper dive into schema v2 and surface interactions.

## Build & test
1. Install dev deps (TypeScript + Chrome types): `npm install`.
2. Compile & copy assets: `npm run build` → outputs to `dist/`.
3. Run smoke tests (URL canonicalization, migration, filters): `npm run test` (rebuilds then executes `dist/tests/run-tests.js`).
4. Load the unpacked extension from `dist/` via `chrome://extensions` (enable **Developer mode**).

> If you prefer editing against source without rebuilding, point Chrome at `dist/` and re-run `npm run build` after changes.

## Usage tips
- **Quick save**: `Alt+S` (Option+S on macOS) or hit the toolbar icon. Duplicates show “Already saved” in the popup with inline edit controls.
- **Dashboard**: open a new tab to explore filters. Saved views capture the entire filter combo (including layout) for one-click recall. “Edit” opens the page and triggers the popup for adjustments.
- **New-tab override toggle**: turn it off in Options to display a dashboard banner instead of forcibly replacing Chrome’s default page (MV3 apps cannot dynamically remove the override).

## Gemini configuration
1. Generate a Gemini API key from [Google AI Studio](https://ai.google.dev/).
2. Paste it into **Options → Gemini API key** and save.
3. The popup will display whether suggestions came from Gemini or heuristics; rationale is shown but not persisted.
4. Keys live in `chrome.storage.sync` and are never bundled in code.

## Data model & privacy
- Main state (`SMART_BOOKMARK_APP_STATE`) lives in `chrome.storage.local` with schema versioning and automatic migration from v1.
- Preferences + secrets (`SMART_BOOKMARK_PREFERENCES`) live in `chrome.storage.sync`.
- Import/export from Options gives you a portable JSON snapshot; “Clear all data” resets to schema v2 defaults.

## Extending the project
- Refine heuristics or prompt wording in `src/lib/heuristics.ts` and `src/lib/llm.ts`.
- Add new saved-view capabilities (e.g., sharing) via `src/lib/storage.ts`.
- Hook up external sync (Notion, Drive, etc.) by extending the build pipeline and storage layer.

## Credits & tagline
Every surface carries the signature tagline: **“Smart Bookmark — crafted with care by Dr. Atul Tiwari.”**

## Development
- Install dependencies: `npm install`
- Build the extension: `npm run build`
- Run tests: `npm run test`

## Linting & Formatting
- Run ESLint: `npm run lint`
- Auto-format using Prettier: `npm run format`

## Load in Chrome
1. Run `npm run build` to refresh the `dist/` folder.
2. Navigate to `chrome://extensions`, enable **Developer Mode**.
3. Choose **Load unpacked** and select the `dist/` directory.

## Configure Gemini key
- Open the extension Options page and paste your Gemini API key (stored via Chrome sync).
- Optionally configure the preferred Gemini model and preset tags/subcategories in the same page.

## Continuous Integration
- GitHub Actions runs `npm ci`, `npm run build`, and `npm test --if-present` on pushes/pull requests to `main`.
- The CI workflow uploads the built `dist/` artifact for download from the run summary.

## Releases
- Tag and push a release in one step: `npm version patch && git push && git push --tags` (swap `patch` for `minor`/`major` as needed).
- GitHub Actions automatically builds, zips the `dist/` folder, and publishes a Release using the default `GITHUB_TOKEN`—no extra secrets required.
- Download the packaged `dist` zip from the Release assets when distributing the extension.
