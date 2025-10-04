import { canonicalizeUrl, extractDomain } from './url.js';
import {
  AppState,
  Category,
  FilterState,
  LinkItem,
  Preferences,
  SCHEMA_VERSION,
  SavedView
} from './types.js';

const APP_STATE_KEY = 'SMART_BOOKMARK_APP_STATE';
const LEGACY_STATE_KEY = 'SMART_BOOKMARK_DATA';
const PREFERENCES_KEY = 'SMART_BOOKMARK_PREFERENCES';
const DEFAULT_CATEGORY = 'Unsorted';

const DEFAULT_INTERESTS = [
  'Pathology',
  'Healthcare',
  'Artificial Intelligence',
  'Deep Learning',
  'Computer Vision',
  'Games',
  '3D Animation',
  'AI in Pathology',
  'AI in Healthcare',
  'AI-assisted Films',
  'AI-assisted Animation'
];

const DEFAULT_PREFERENCES: Preferences = {
  geminiApiKey: undefined,
  geminiModel: 'gemini-2.5-flash',
  interests: [...DEFAULT_INTERESTS],
  tagPresets: ['AI', 'Healthcare', 'Research', 'To Read'],
  subcategoryPresets: ['Overview', 'Tutorial', 'Paper', 'Video'],
  replaceNewTab: true
};

function defaultCategories(): Category[] {
  return [
    {
      name: DEFAULT_CATEGORY,
      subcategories: []
    }
  ];
}

export function createEmptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    links: [],
    categories: defaultCategories(),
    tagIndex: [],
    savedViews: [],
    lastUpdatedAt: new Date().toISOString()
  };
}

type LegacyEntry = {
  id: string;
  url: string;
  title?: string;
  summary?: string;
  categoryId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyCategory = {
  id: string;
  name: string;
};

type LegacyState = {
  entries?: LegacyEntry[];
  categories?: LegacyCategory[];
  categoryOrder?: string[];
};

function hashPlaceholder(url: string): string {
  // This placeholder will be replaced with actual hash during save flow if missing.
  return canonicalizeUrl(url);
}

function deriveLegacyCategoryName(entry: LegacyEntry, categories: LegacyCategory[]): string {
  if (entry.categoryId) {
    const match = categories.find((category) => category.id === entry.categoryId);
    if (match?.name) {
      return match.name;
    }
  }
  return DEFAULT_CATEGORY;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function migrateLegacyState(raw: LegacyState): Promise<AppState> {
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const categories = Array.isArray(raw.categories) ? raw.categories : [];

  const migratedLinks: LinkItem[] = [];

  for (const entry of entries) {
    if (!entry.url) {
      continue;
    }

    const canonicalUrl = canonicalizeUrl(entry.url);
    const domain = extractDomain(canonicalUrl);

    migratedLinks.push({
      id: entry.id || crypto.randomUUID(),
      url: canonicalUrl,
      domain,
      title: entry.title || canonicalUrl,
      summary: entry.summary || undefined,
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt,
      category: deriveLegacyCategoryName(entry, categories),
      subcategory: undefined,
      tags: [],
      urlHash: hashPlaceholder(canonicalUrl),
      contentHash: undefined
    });
  }

  const categoryNames = uniqueSorted(migratedLinks.map((link) => link.category));
  const migratedCategories: Category[] = categoryNames.map((name) => ({ name, subcategories: [] }));
  if (!categoryNames.includes(DEFAULT_CATEGORY)) {
    migratedCategories.unshift({ name: DEFAULT_CATEGORY, subcategories: [] });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    links: migratedLinks,
    categories: migratedCategories,
    tagIndex: [],
    savedViews: [],
    lastUpdatedAt: new Date().toISOString()
  };
}

function ensureSchemaV2(state: AppState): AppState {
  const categories = state.categories?.length ? state.categories : defaultCategories();
  const tagIndex = uniqueSorted(state.tagIndex || []);
  const savedViews = state.savedViews || [];

  for (const link of state.links) {
    if (!link.category) {
      link.category = DEFAULT_CATEGORY;
    }
    if (!Array.isArray(link.tags)) {
      link.tags = [];
    }
    if (!link.urlHash) {
      link.urlHash = hashPlaceholder(link.url);
    }
    if (!link.domain) {
      link.domain = extractDomain(link.url);
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    links: state.links,
    categories,
    tagIndex,
    savedViews,
    lastUpdatedAt: state.lastUpdatedAt || new Date().toISOString()
  };
}

export async function migrateAppState(raw: unknown): Promise<AppState> {
  if (!raw || typeof raw !== 'object') {
    return createEmptyState();
  }

  const candidate = raw as Partial<AppState> & { schemaVersion?: number };

  if (!candidate.schemaVersion) {
    if ('entries' in candidate || 'categories' in candidate || 'categoryOrder' in candidate) {
      return migrateLegacyState(candidate as LegacyState);
    }
  }

  if (!candidate.schemaVersion || candidate.schemaVersion < SCHEMA_VERSION) {
    return ensureSchemaV2({
      schemaVersion: SCHEMA_VERSION,
      links: Array.isArray(candidate.links) ? candidate.links : [],
      categories: Array.isArray(candidate.categories) ? candidate.categories : defaultCategories(),
      tagIndex: Array.isArray(candidate.tagIndex) ? candidate.tagIndex : [],
      savedViews: Array.isArray(candidate.savedViews) ? candidate.savedViews : [],
      lastUpdatedAt: candidate.lastUpdatedAt
    });
  }

  return ensureSchemaV2(candidate as AppState);
}

export async function loadAppState(): Promise<AppState> {
  const result = await chrome.storage.local.get([APP_STATE_KEY, LEGACY_STATE_KEY]);

  if (result[APP_STATE_KEY]) {
    return migrateAppState(result[APP_STATE_KEY]);
  }

  if (result[LEGACY_STATE_KEY]) {
    const migrated = await migrateLegacyState(result[LEGACY_STATE_KEY] as LegacyState);
    await chrome.storage.local.set({ [APP_STATE_KEY]: migrated });
    await chrome.storage.local.remove(LEGACY_STATE_KEY);
    return migrated;
  }

  const initial = createEmptyState();
  await chrome.storage.local.set({ [APP_STATE_KEY]: initial });
  return initial;
}

export async function saveAppState(nextState: AppState): Promise<void> {
  const payload: AppState = {
    ...nextState,
    schemaVersion: SCHEMA_VERSION,
    lastUpdatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [APP_STATE_KEY]: payload });
}

export async function resetAppState(): Promise<AppState> {
  const empty = createEmptyState();
  await saveAppState(empty);
  return empty;
}

export async function loadPreferences(): Promise<Preferences> {
  const result = await chrome.storage.sync.get(PREFERENCES_KEY);
  const raw = result[PREFERENCES_KEY];

  if (!raw || typeof raw !== 'object') {
    await chrome.storage.sync.set({ [PREFERENCES_KEY]: DEFAULT_PREFERENCES });
    return DEFAULT_PREFERENCES;
  }

  const preferences = raw as Partial<Preferences>;
  return {
    geminiApiKey: typeof preferences.geminiApiKey === 'string' ? preferences.geminiApiKey : undefined,
    geminiModel: preferences.geminiModel || DEFAULT_PREFERENCES.geminiModel,
    interests: Array.isArray(preferences.interests) && preferences.interests.length
      ? preferences.interests
      : [...DEFAULT_INTERESTS],
    tagPresets: Array.isArray(preferences.tagPresets) ? preferences.tagPresets : [...DEFAULT_PREFERENCES.tagPresets],
    subcategoryPresets: Array.isArray(preferences.subcategoryPresets)
      ? preferences.subcategoryPresets
      : [...DEFAULT_PREFERENCES.subcategoryPresets],
    replaceNewTab: typeof preferences.replaceNewTab === 'boolean'
      ? preferences.replaceNewTab
      : DEFAULT_PREFERENCES.replaceNewTab
  };
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await chrome.storage.sync.set({ [PREFERENCES_KEY]: preferences });
}

export async function withAppState(
  updateFn: (state: AppState) => Promise<AppState | void> | AppState | void
): Promise<AppState> {
  const state = await loadAppState();
  const draft = structuredClone(state) as AppState;
  const result = await updateFn(draft);
  const nextState = (result && typeof result === 'object') ? (result as AppState) : draft;
  await saveAppState(nextState);
  return nextState;
}

export function getDefaultCategory(): string {
  return DEFAULT_CATEGORY;
}

export function deriveCategoriesFromLinks(links: LinkItem[]): Category[] {
  const map = new Map<string, Set<string>>();
  for (const link of links) {
    if (!map.has(link.category)) {
      map.set(link.category, new Set());
    }
    if (link.subcategory) {
      map.get(link.category)?.add(link.subcategory);
    }
  }
  const categories: Category[] = [];
  for (const [name, subcategories] of map.entries()) {
    categories.push({ name, subcategories: Array.from(subcategories).sort((a, b) => a.localeCompare(b)) });
  }
  if (!map.has(DEFAULT_CATEGORY)) {
    categories.push({ name: DEFAULT_CATEGORY, subcategories: [] });
  }
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return categories;
}

export function deriveTagIndex(links: LinkItem[]): string[] {
  const tags = links.flatMap((link) => link.tags || []);
  return uniqueSorted(tags);
}

export async function listSavedViews(): Promise<SavedView[]> {
  const state = await loadAppState();
  return state.savedViews || [];
}

export type LinkDraft = {
  id?: string;
  url: string;
  domain: string;
  title: string;
  summary?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  urlHash: string;
  contentHash?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeDraft(draft: LinkDraft): LinkDraft {
  return {
    ...draft,
    title: draft.title || draft.url,
    category: draft.category || DEFAULT_CATEGORY,
    subcategory: draft.subcategory || undefined,
    tags: Array.from(new Set(draft.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [])).sort((a, b) =>
      a.localeCompare(b)
    )
  };
}

export async function findLinkByUrlHash(urlHash: string): Promise<LinkItem | undefined> {
  const state = await loadAppState();
  return state.links.find((link) => link.urlHash === urlHash);
}

export async function upsertLink(draft: LinkDraft): Promise<{ link: LinkItem; created: boolean; state: AppState }> {
  const normalized = normalizeDraft(draft);

  let created = false;

  const nextState = await withAppState(async (state) => {
    const existingIndex = state.links.findIndex((link) => link.urlHash === normalized.urlHash);
    const timestamp = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = state.links[existingIndex];
      const merged: LinkItem = {
        ...existing,
        ...normalized,
        id: existing.id,
        createdAt: existing.createdAt || timestamp,
        updatedAt: timestamp,
        tags: normalized.tags
      };
      state.links[existingIndex] = merged;
    } else {
      const link: LinkItem = {
        id: normalized.id || crypto.randomUUID(),
        url: normalized.url,
        domain: normalized.domain,
        title: normalized.title,
        summary: normalized.summary,
        createdAt: normalized.createdAt || timestamp,
        updatedAt: normalized.updatedAt,
        category: normalized.category,
        subcategory: normalized.subcategory,
        tags: normalized.tags,
        urlHash: normalized.urlHash,
        contentHash: normalized.contentHash
      };
      state.links.unshift(link);
      created = true;
    }

    state.categories = deriveCategoriesFromLinks(state.links);
    state.tagIndex = deriveTagIndex(state.links);
    state.lastUpdatedAt = timestamp;

    return state;
  });

  const link = nextState.links.find((item) => item.urlHash === normalized.urlHash);
  if (!link) {
    throw new Error('Failed to persist link.');
  }

  return { link, created, state: nextState };
}

export async function removeLink(linkId: string): Promise<AppState> {
  return withAppState((state) => {
    const filtered = state.links.filter((link) => link.id !== linkId);
    state.links = filtered;
    state.categories = deriveCategoriesFromLinks(filtered);
    state.tagIndex = deriveTagIndex(filtered);
    state.lastUpdatedAt = new Date().toISOString();
    return state;
  });
}

export async function saveFilterView(name: string, filters: FilterState): Promise<SavedView> {
  const newView: SavedView = {
    id: crypto.randomUUID(),
    name,
    filters,
    createdAt: new Date().toISOString()
  };

  const state = await withAppState((draft) => {
    const existingIndex = draft.savedViews.findIndex((view) => view.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      draft.savedViews[existingIndex] = { ...newView, id: draft.savedViews[existingIndex].id };
    } else {
      draft.savedViews.unshift(newView);
    }
    draft.savedViews = draft.savedViews.slice(0, 25);
    return draft;
  });

  return state.savedViews[0];
}

export async function deleteFilterView(id: string): Promise<void> {
  await withAppState((draft) => {
    draft.savedViews = draft.savedViews.filter((view) => view.id !== id);
    return draft;
  });
}
