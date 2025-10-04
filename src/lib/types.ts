export const SCHEMA_VERSION = 2;

export type LinkItem = {
  id: string;
  url: string;
  domain: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  urlHash: string;
  contentHash?: string;
};

export type Category = {
  name: string;
  subcategories: string[];
};

export type SavedView = {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
};

export type FilterState = {
  text: string;
  category?: string;
  subcategory?: string;
  tags: string[];
  domains: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  layout: 'list' | 'grid';
};

export type AppState = {
  schemaVersion: number;
  links: LinkItem[];
  categories: Category[];
  tagIndex: string[];
  savedViews: SavedView[];
  lastUpdatedAt?: string;
};

export type Preferences = {
  geminiApiKey?: string;
  geminiModel: string;
  interests: string[];
  tagPresets: string[];
  subcategoryPresets: string[];
  replaceNewTab: boolean;
};

export type GeminiClassification = {
  summary?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  rationale?: string;
};
