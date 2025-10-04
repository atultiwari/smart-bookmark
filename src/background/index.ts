import { BackgroundRequest, BackgroundResponse } from '../common/messages.js';
import { classifyWithLLM } from '../lib/llm.js';
import type { ClassificationResult } from '../lib/llm.js';
import {
  findLinkByUrlHash,
  loadAppState,
  loadPreferences,
  upsertLink
} from '../lib/storage.js';
import { canonicalizeUrl, extractDomain, sha256Hex } from '../lib/url.js';

type SuggestionCacheEntry = {
  snippet: string;
  suggestion?: ClassificationResult;
  fetchedAt: number;
};

const suggestionCache = new Map<string, SuggestionCacheEntry>();

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractVisibleText(tabId: number): Promise<string> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const root = document.body || document.documentElement;
        if (!root) {
          return '';
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const chunks: string[] = [];
        let count = 0;
        while (walker.nextNode() && count < 400) {
          const value = walker.currentNode?.textContent || '';
          const normalized = value.replace(/\s+/g, ' ').trim();
          if (normalized.length > 40) {
            chunks.push(normalized);
            count += 1;
          }
        }
        return chunks.join(' ').slice(0, 4000);
      }
    });
    return typeof result?.result === 'string' ? result.result : '';
  } catch (error) {
    console.warn('Unable to extract text from tab', error);
    return '';
  }
}

async function buildPopupPayload(tab: chrome.tabs.Tab, options: { force?: boolean } = {}) {
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error('Only http(s) tabs can be saved.');
  }
  if (typeof tab.id !== 'number') {
    throw new Error('Active tab is unavailable.');
  }
  const force = Boolean(options.force);

  const title = tab.title || tab.url;
  const canonicalUrl = canonicalizeUrl(tab.url);
  const domain = extractDomain(canonicalUrl);
  const urlHash = await sha256Hex(canonicalUrl);

  const [state, existingLink, preferences] = await Promise.all([
    loadAppState(),
    findLinkByUrlHash(urlHash),
    loadPreferences()
  ]);

  const categoryNames = state.categories.map((category) => category.name);
  const cached = suggestionCache.get(urlHash);

  let snippet: string;
  let suggestion: ClassificationResult | undefined;

  if (existingLink && !force && !cached) {
    snippet = '';
    suggestion = undefined;
  } else if (!force && cached) {
    snippet = cached.snippet;
    suggestion = cached.suggestion;
  } else {
    snippet = await extractVisibleText(tab.id);
    suggestion = await classifyWithLLM({
      title,
      url: canonicalUrl,
      snippet,
      domain,
      categories: categoryNames
    });
    suggestionCache.set(urlHash, {
      snippet,
      suggestion,
      fetchedAt: Date.now()
    });
  }

  if (!snippet && cached) {
    snippet = cached.snippet;
  }

  return {
    tab: {
      id: tab.id,
      title,
      url: tab.url,
      canonicalUrl,
      domain
    },
    snippet,
    urlHash,
    isDuplicate: Boolean(existingLink),
    existingLink: existingLink || undefined,
    suggestion,
    categories: state.categories,
    tagIndex: state.tagIndex,
    preferences
  };
}

async function handleInitPopup(): Promise<BackgroundResponse> {
  const tab = await getActiveTab();
  if (!tab) {
    return { status: 'error', message: 'No active tab found.' };
  }

  try {
    const payload = await buildPopupPayload(tab);
    return { status: 'success', data: payload };
  } catch (error) {
    console.error('INIT_POPUP failed', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to initialize popup.'
    };
  }
}

async function handleSaveLink(request: BackgroundRequest & { type: 'SAVE_LINK' }): Promise<BackgroundResponse> {
  const { payload } = request;

  try {
    const canonicalUrl = canonicalizeUrl(payload.canonicalUrl || payload.url);
    const urlHash = await sha256Hex(canonicalUrl);
    const domain = extractDomain(canonicalUrl);
    const contentHash = payload.snippet ? await sha256Hex(payload.snippet) : payload.contentHash;

    const { link, created } = await upsertLink({
      url: canonicalUrl,
      domain,
      title: payload.title,
      summary: payload.summary,
      category: payload.category,
      subcategory: payload.subcategory,
      tags: payload.tags,
      urlHash,
      contentHash,
      updatedAt: new Date().toISOString()
    });

    suggestionCache.delete(urlHash);

    return {
      status: 'success',
      link,
      created,
      message: created ? 'Link saved.' : 'Link updated.'
    };
  } catch (error) {
    console.error('SAVE_LINK failed', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to save link.'
    };
  }
}

async function handleLoadStateSummary(): Promise<BackgroundResponse> {
  try {
    const state = await loadAppState();
    return {
      status: 'success',
      summary: {
        totalLinks: state.links.length,
        categories: state.categories,
        tags: state.tagIndex,
        lastUpdatedAt: state.lastUpdatedAt
      }
    };
  } catch (error) {
    console.error('LOAD_STATE_SUMMARY failed', error);
    return {
      status: 'error',
      message: 'Unable to load saved data.'
    };
  }
}

async function quickSaveActiveTab(): Promise<void> {
  const tab = await getActiveTab();
  if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
    await showNotification('Smart Bookmark', 'Active tab cannot be saved.');
    return;
  }

  const title = tab.title || tab.url;
  const snippet = await extractVisibleText(tab.id!);
  const canonicalUrl = canonicalizeUrl(tab.url);
  const domain = extractDomain(canonicalUrl);
  const urlHash = await sha256Hex(canonicalUrl);
  const [state, existing] = await Promise.all([
    loadAppState(),
    findLinkByUrlHash(urlHash)
  ]);

  if (existing) {
    await showNotification('Smart Bookmark', 'This link is already saved.');
    return;
  }

  const suggestion = await classifyWithLLM({
    title,
    url: canonicalUrl,
    snippet,
    domain,
    categories: state.categories.map((category) => category.name)
  });
  const { link } = await upsertLink({
    url: canonicalUrl,
    domain,
    title,
    summary: suggestion.summary,
    category: suggestion.category,
    subcategory: suggestion.subcategory,
    tags: suggestion.tags,
    urlHash,
    contentHash: snippet ? await sha256Hex(snippet) : undefined
  });

  await showNotification('Smart Bookmark', `Saved to ${link.category}${link.subcategory ? ` › ${link.subcategory}` : ''}`);
}

async function showNotification(title: string, message: string): Promise<void> {
  try {
    await chrome.notifications.create('', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/logo-128.png'),
      title,
      message
    });
  } catch (error) {
    console.warn('Failed to display notification', error);
  }
}

async function handleRefreshSuggestion(
  request: BackgroundRequest & { type: 'REFRESH_SUGGESTION'; payload: { tabId: number } }
): Promise<{ status: 'success' | 'error'; suggestion?: ClassificationResult; snippet?: string; message?: string }> {
  const { tabId } = request.payload;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) {
      throw new Error('Tab unavailable for refresh.');
    }
    const payload = await buildPopupPayload(tab, { force: true });
    return {
      status: 'success',
      suggestion: payload.suggestion,
      snippet: payload.snippet
    };
  } catch (error) {
    console.error('REFRESH_SUGGESTION failed', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to refresh suggestion.'
    };
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  (async () => {
    let response: BackgroundResponse;
    switch (request.type) {
      case 'INIT_POPUP':
        response = await handleInitPopup();
        break;
      case 'SAVE_LINK':
        response = await handleSaveLink(request);
        break;
      case 'LOAD_STATE_SUMMARY':
        response = await handleLoadStateSummary();
        break;
      case 'REFRESH_SUGGESTION':
        response = await handleRefreshSuggestion(request);
        break;
      case 'OPEN_DASHBOARD':
        await chrome.tabs.create({ url: 'chrome://newtab' });
        response = { status: 'success' };
        break;
      default:
        response = { status: 'error', message: 'Unknown request' } as BackgroundResponse;
    }
    sendResponse(response);
  })().catch((error) => {
    console.error('Background message handler failed', error);
    sendResponse({ status: 'error', message: 'Unexpected error occurred.' } as BackgroundResponse);
  });
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-active-tab') {
    await quickSaveActiveTab();
  }
  if (command === 'open-dashboard') {
    await chrome.tabs.create({ url: 'chrome://newtab' });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'smart-bookmark-quick-save',
    title: 'Save with Smart Bookmark',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'smart-bookmark-quick-save') {
    await quickSaveActiveTab();
  }
});
