import {
  BackgroundResponse,
  InitPopupResponse,
  PopupInitPayload,
  RefreshSuggestionResponse,
  SaveLinkResponse
} from '../common/messages.js';

const titleInput = document.getElementById('title-input') as HTMLInputElement;
const categoryInput = document.getElementById('category-input') as HTMLInputElement;
const subcategoryInput = document.getElementById('subcategory-input') as HTMLInputElement;
const summaryInput = document.getElementById('summary-input') as HTMLTextAreaElement;
const tagContainer = document.getElementById('tag-container') as HTMLDivElement;
const tagInput = document.getElementById('tag-input') as HTMLInputElement;
const tagTemplate = document.getElementById('tag-template') as HTMLTemplateElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const suggestionSection = document.getElementById('suggestion') as HTMLElement;
const suggestionSummary = document.getElementById('suggestion-summary') as HTMLParagraphElement;
const suggestionCategory = document.getElementById('suggestion-category') as HTMLElement;
const suggestionSubcategory = document.getElementById('suggestion-subcategory') as HTMLElement;
const suggestionTags = document.getElementById('suggestion-tags') as HTMLElement;
const suggestionRationale = document.getElementById('suggestion-rationale') as HTMLElement;
const suggestionPill = document.getElementById('suggestion-pill') as HTMLElement;
const applySuggestionButton = document.getElementById('apply-suggestion') as HTMLButtonElement;
const refreshSuggestionButton = document.getElementById('refresh-suggestion') as HTMLButtonElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const dashboardButton = document.getElementById('dashboard-button') as HTMLButtonElement;
const categoryList = document.getElementById('category-list') as HTMLDataListElement;
const subcategoryList = document.getElementById('subcategory-list') as HTMLDataListElement;
const tagList = document.getElementById('tag-list') as HTMLDataListElement;

const state: {
  data?: PopupInitPayload;
  tags: string[];
  refreshing: boolean;
} = {
  tags: [],
  refreshing: false
};

function setStatus(text: string) {
  statusElement.textContent = text;
}

function populateCategories() {
  if (!state.data) {
    return;
  }
  categoryList.innerHTML = '';
  for (const category of state.data.categories) {
    const option = document.createElement('option');
    option.value = category.name;
    categoryList.appendChild(option);
  }
}

function populateSubcategories(categoryName: string) {
  if (!state.data) {
    return;
  }
  subcategoryList.innerHTML = '';
  const category = state.data.categories.find((cat) => cat.name === categoryName);
  const sources = new Set<string>();
  if (category) {
    for (const subcategory of category.subcategories) {
      sources.add(subcategory);
    }
  }
  for (const preset of state.data.preferences.subcategoryPresets || []) {
    sources.add(preset);
  }
  for (const value of sources) {
    const option = document.createElement('option');
    option.value = value;
    subcategoryList.appendChild(option);
  }
}

function populateTagList() {
  if (!state.data) {
    return;
  }
  const suggestions = new Set<string>([
    ...state.data.tagIndex,
    ...(state.data.preferences.tagPresets || []),
    ...(state.data.suggestion?.tags || [])
  ]);
  tagList.innerHTML = '';
  for (const tag of suggestions) {
    const option = document.createElement('option');
    option.value = tag;
    tagList.appendChild(option);
  }
}

function renderTags() {
  tagContainer.innerHTML = '';
  for (const tag of state.tags) {
    const fragment = tagTemplate.content.cloneNode(true) as DocumentFragment;
    const chip = fragment.querySelector('.tag-chip') as HTMLElement;
    const label = fragment.querySelector('.tag-chip__label') as HTMLElement;
    const button = fragment.querySelector('.tag-chip__remove') as HTMLButtonElement;
    label.textContent = tag;
    button.addEventListener('click', () => removeTag(tag));
    tagContainer.appendChild(chip);
  }
}

function addTag(tag: string) {
  const value = tag.trim();
  if (!value) {
    return;
  }
  if (!state.tags.includes(value)) {
    state.tags.push(value);
    state.tags.sort((a, b) => a.localeCompare(b));
    renderTags();
  }
}

function removeTag(tag: string) {
  state.tags = state.tags.filter((item) => item !== tag);
  renderTags();
}

function applySuggestion() {
  if (!state.data?.suggestion) {
    return;
  }
  const suggestion = state.data.suggestion;
  if (suggestion.summary) {
    summaryInput.value = suggestion.summary;
  }
  if (suggestion.category) {
    categoryInput.value = suggestion.category;
    populateSubcategories(suggestion.category);
  }
  if (suggestion.subcategory) {
    subcategoryInput.value = suggestion.subcategory;
  }
  if (suggestion.tags?.length) {
    state.tags = Array.from(new Set(suggestion.tags.map((tag) => tag.trim()))).filter(Boolean);
    renderTags();
  }
  setStatus('Suggestion applied.');
}

function hydrateForm(data: PopupInitPayload) {
  state.data = data;

  titleInput.value = data.existingLink?.title || data.tab.title;
  summaryInput.value = data.existingLink?.summary || data.suggestion?.summary || '';
  categoryInput.value = data.existingLink?.category || data.suggestion?.category || '';
  populateSubcategories(categoryInput.value);
  subcategoryInput.value = data.existingLink?.subcategory || data.suggestion?.subcategory || '';
  state.tags = data.existingLink?.tags?.length
    ? [...data.existingLink.tags]
    : [...(data.suggestion?.tags || [])];
  renderTags();

  populateCategories();
  populateTagList();
  renderSuggestion();
  updateStatusForCurrentContext();
}

function handleTagInput(event: KeyboardEvent) {
  if (!['Enter', 'Tab', ','].includes(event.key)) {
    return;
  }
  event.preventDefault();
  addTag(tagInput.value);
  tagInput.value = '';
}

async function requestInit() {
  setStatus('Preparing…');
  const response = (await chrome.runtime.sendMessage({ type: 'INIT_POPUP' })) as BackgroundResponse;
  const init = response as InitPopupResponse;
  if (init.status === 'success' && init.data) {
    hydrateForm(init.data);
  } else {
    setStatus(init.message || 'Unable to prepare popup.');
    saveButton.disabled = true;
  }
}

async function saveLink() {
  if (!state.data) {
    return;
  }
  saveButton.disabled = true;
  setStatus('Saving…');

  const payload = {
    url: state.data.tab.url,
    canonicalUrl: state.data.tab.canonicalUrl,
    domain: state.data.tab.domain,
    title: titleInput.value.trim() || state.data.tab.title,
    summary: summaryInput.value.trim(),
    category: categoryInput.value.trim() || 'Unsorted',
    subcategory: subcategoryInput.value.trim() || undefined,
    tags: state.tags,
    urlHash: state.data.urlHash,
    snippet: state.data.snippet
  };

  const response = (await chrome.runtime.sendMessage({
    type: 'SAVE_LINK',
    payload
  })) as SaveLinkResponse;

  if (response.status === 'success') {
    setStatus(response.message || 'Saved.');
  } else {
    setStatus(response.message || 'Failed to save.');
    saveButton.disabled = false;
  }
}

function openDashboard() {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  window.close();
}

function updateStatusForCurrentContext() {
  if (!state.data) {
    return;
  }

  if (state.data.isDuplicate) {
    setStatus('Already saved — edit fields or use Refresh AI to update.');
    return;
  }

  const suggestion = state.data.suggestion;
  if (!suggestion) {
    setStatus('AI suggestion unavailable. Click Refresh AI to try again.');
    return;
  }

  if (!suggestion.usedLLM) {
    if (suggestion.reason === 'missing-key') {
      setStatus('Add your Gemini API key in Options to enable AI suggestions.');
    } else if (suggestion.reason === 'error') {
      setStatus('Gemini request failed — showing heuristic suggestion.');
    } else {
      setStatus('Using heuristic suggestion.');
    }
    return;
  }

  setStatus('Ready to save.');
}

function renderSuggestion() {
  if (!state.data) {
    suggestionSection.hidden = true;
    return;
  }

  suggestionSection.hidden = false;

  const suggestion = state.data.suggestion;
  if (!suggestion) {
    suggestionSummary.textContent = 'No AI suggestion yet. Click Refresh AI to generate one.';
    suggestionCategory.textContent = '—';
    suggestionSubcategory.textContent = '—';
    suggestionTags.textContent = '—';
    suggestionRationale.textContent = '—';
    suggestionPill.textContent = 'Pending';
    suggestionPill.title = '';
    return;
  }

  suggestionSummary.textContent = suggestion.summary || '—';
  suggestionCategory.textContent = suggestion.category || '—';
  suggestionSubcategory.textContent = suggestion.subcategory || '—';
  suggestionTags.textContent = suggestion.tags?.join(', ') || '—';
  suggestionRationale.textContent = suggestion.rationale || suggestion.errorMessage || 'Not provided.';
  suggestionPill.textContent = suggestion.usedLLM ? 'Gemini' : 'Heuristic';
  suggestionPill.title = suggestion.errorMessage || '';
}

async function refreshSuggestion() {
  if (!state.data || state.refreshing) {
    return;
  }
  state.refreshing = true;
  refreshSuggestionButton.disabled = true;
  setStatus('Refreshing AI suggestion…');
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'REFRESH_SUGGESTION',
      payload: { tabId: state.data.tab.id }
    })) as RefreshSuggestionResponse;

    if (response.status === 'success') {
      state.data.suggestion = response.suggestion;
      if (response.snippet) {
        state.data.snippet = response.snippet;
      }
      populateTagList();
      renderSuggestion();
      updateStatusForCurrentContext();
      setStatus('Suggestion refreshed.');
    } else {
      setStatus(response.message || 'Failed to refresh suggestion.');
    }
  } catch (error) {
    console.error('Failed to refresh suggestion', error);
    setStatus('Failed to refresh suggestion.');
  } finally {
    state.refreshing = false;
    refreshSuggestionButton.disabled = false;
  }
}

categoryInput.addEventListener('input', () => {
  populateSubcategories(categoryInput.value);
});

tagInput.addEventListener('keydown', handleTagInput);
applySuggestionButton.addEventListener('click', applySuggestion);
refreshSuggestionButton.addEventListener('click', refreshSuggestion);
saveButton.addEventListener('click', saveLink);
dashboardButton.addEventListener('click', openDashboard);

tagInput.addEventListener('blur', () => {
  if (tagInput.value.trim()) {
    addTag(tagInput.value.trim());
    tagInput.value = '';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  requestInit();
});
