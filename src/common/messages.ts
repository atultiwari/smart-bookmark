import { Category, LinkItem, Preferences } from '../lib/types.js';
import { ClassificationResult } from '../lib/llm.js';

export type InitPopupRequest = {
  type: 'INIT_POPUP';
};

export type InitPopupResponse = {
  status: 'success' | 'error';
  message?: string;
  data?: PopupInitPayload;
};

export type PopupInitPayload = {
  tab: {
    id: number;
    title: string;
    url: string;
    canonicalUrl: string;
    domain: string;
  };
  snippet: string;
  urlHash: string;
  isDuplicate: boolean;
  existingLink?: LinkItem;
  suggestion?: ClassificationResult;
  categories: Category[];
  tagIndex: string[];
  preferences: Preferences;
};

export type SaveLinkRequest = {
  type: 'SAVE_LINK';
  payload: {
    url: string;
    canonicalUrl: string;
    domain: string;
    title: string;
    summary: string;
    category: string;
    subcategory?: string;
    tags: string[];
    urlHash: string;
    snippet?: string;
    contentHash?: string;
  };
};

export type SaveLinkResponse = {
  status: 'success' | 'error';
  message?: string;
  link?: LinkItem;
  created?: boolean;
};

export type LoadStateSummaryRequest = {
  type: 'LOAD_STATE_SUMMARY';
};

export type LoadStateSummaryResponse = {
  status: 'success' | 'error';
  summary?: {
    totalLinks: number;
    categories: Category[];
    tags: string[];
    lastUpdatedAt?: string;
  };
  message?: string;
};

export type RefreshSuggestionRequest = {
  type: 'REFRESH_SUGGESTION';
  payload: {
    tabId: number;
  };
};

export type RefreshSuggestionResponse = {
  status: 'success' | 'error';
  suggestion?: ClassificationResult;
  snippet?: string;
  message?: string;
};

export type BackgroundRequest =
  | InitPopupRequest
  | SaveLinkRequest
  | LoadStateSummaryRequest
  | RefreshSuggestionRequest
  | { type: 'OPEN_DASHBOARD' };

export type BackgroundResponse =
  | InitPopupResponse
  | SaveLinkResponse
  | LoadStateSummaryResponse
  | RefreshSuggestionResponse
  | { status: 'success' };
