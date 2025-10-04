# Smart Bookmark v2 Architecture

## Overview
- **Primary goal**: capture the active tab, deduplicate against canonical URLs, and enrich each link with Gemini-backed summaries + categories.
- **Storage**: versioned app state (`schemaVersion = 2`) in `chrome.storage.local` plus synced preferences/API secrets in `chrome.storage.sync`.
- **Surfaces**: popup editor for quick review, AI-assisted new-tab dashboard, rich options screen, and keyboard shortcuts for one-tap saves.

## Project layout
```
Chrome_Ext_Smart_Bookmark/
├── css/                     # Shared styles copied to dist/
├── docs/                    # Architecture & planning notes
├── icons/                   # Extension icons (16–128px)
├── pages/                   # HTML entry points (popup/new tab/options)
├── src/
│   ├── background/          # MV3 service worker
│   ├── common/              # Message contracts
│   ├── lib/                 # Canonical URL utils, storage, LLM client, filters
│   ├── newtab/              # Dashboard runtime
│   ├── options/             # Settings controller
│   ├── popup/               # Popup runtime
│   └── tests/               # Lightweight Node-based unit tests
├── tools/                   # Build helper scripts
├── manifest.json            # MV3 manifest
├── package.json             # Build & test scripts
└── tsconfig.json            # TypeScript compiler config
```

## Data model (schema v2)
Stored in `chrome.storage.local` under `SMART_BOOKMARK_APP_STATE` and migrated from the legacy v1 blob on first load.
```
{
  schemaVersion: 2,
  links: [
    {
      id: string,
      url: string,           // canonicalized URL
      domain: string,
      title: string,
      summary?: string,
      createdAt: string,
      updatedAt?: string,
      category: string,
      subcategory?: string,
      tags: string[],
      urlHash: string,       // sha256(canonicalUrl)
      contentHash?: string
    }
  ],
  categories: [
    {
      name: string,
      subcategories: string[]
    }
  ],
  tagIndex: string[],
  savedViews: [
    {
      id: string,
      name: string,
      filters: FilterState,
      createdAt: string
    }
  ],
  lastUpdatedAt?: string
}
```
`FilterState` captures the dashboard filter combo (text, category/subcategory, tag AND-set, domain list, date range, layout).

Preferences in `chrome.storage.sync`:
```
{
  geminiApiKey?: string,
  interests: string[],
  tagPresets: string[],
  subcategoryPresets: string[],
  replaceNewTab: boolean
}
```

## AI assist pipeline
1. Service worker gathers tab metadata and a trimmed text snippet via `chrome.scripting.executeScript`.
2. URL is canonicalized (`url.ts`), hashed, and checked against existing entries (`storage.ts`).
3. When new, `llm.ts` composes the Gemini prompt and merges the JSON response; on failure or missing key, `heuristics.ts` supplies category/tags.
4. Popup receives `InitPopupResponse` with duplicate status, suggestions, preferences, and schema metadata.
5. On save, data flows through `upsertLink`, refreshing categories, tag index, and saved views.

## Dashboard filtering flow
- `filterLinks` in `lib/filtering.ts` enforces AND semantics on tags, optional subcategory dependency, domain multi-select, and date ranges.
- Saved views persist the full `FilterState`, allowing one-click recall alongside the virtual “Recent” view.
- Layout toggles between list/grid while cards expose open/delete/edit controls (edit opens the saved URL and auto-launches the popup for updates).

## Build & tests
- `npm run build` → cleans `dist/`, compiles TypeScript via `tsc`, and copies manifest/assets.
- `npm run test` → rebuilds then runs Node-based smoke tests for URL canonicalization, migration, and filter logic.

## Notes
- New-tab override respects the `replaceNewTab` preference by showing an inline warning rather than removing the manifest override (MV3 limitation).
- All Gemini interactions guard for missing keys and fall back to heuristics; the rationale returned by Gemini is surfaced in the popup but not persisted.
