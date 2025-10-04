import { FilterState, LinkItem, SavedView } from '../lib/types.js';
import { deleteFilterView, loadAppState, loadPreferences, removeLink, saveFilterView } from '../lib/storage.js';
import { filterLinks } from '../lib/filtering.js';

const cardsContainer = document.getElementById('cards') as HTMLElement;
const summaryElement = document.getElementById('summary') as HTMLElement;
const categorySelect = document.getElementById('filter-category') as HTMLSelectElement;
const subcategoryContainer = document.getElementById('filter-subcategories') as HTMLElement;
const tagContainer = document.getElementById('filter-tags') as HTMLElement;
const domainContainer = document.getElementById('filter-domains') as HTMLElement;
const textInput = document.getElementById('filter-text') as HTMLInputElement;
const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement;
const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement;
const savedViewsContainer = document.getElementById('saved-views') as HTMLElement;
const saveViewButton = document.getElementById('save-view') as HTMLButtonElement;
const viewNameInput = document.getElementById('view-name') as HTMLInputElement;
const viewChipsContainer = document.getElementById('view-chips') as HTMLElement;
const listToggle = document.getElementById('list-toggle') as HTMLButtonElement;
const gridToggle = document.getElementById('grid-toggle') as HTMLButtonElement;
const cardTemplate = document.getElementById('card-template') as HTMLTemplateElement;
const chipTemplate = document.getElementById('chip-template') as HTMLTemplateElement;
const overrideBanner = document.getElementById('override-warning') as HTMLElement;
const openDefaultButton = document.getElementById('open-default') as HTMLButtonElement;

const state: {
  filters: FilterState;
  links: LinkItem[];
  categories: string[];
  subcategoryMap: Map<string, string[]>;
  tagIndex: string[];
  domainIndex: string[];
  savedViews: SavedView[];
  activeViewId?: string;
} = {
  filters: {
    text: '',
    category: undefined,
    subcategory: undefined,
    tags: [],
    domains: [],
    layout: 'list'
  },
  links: [],
  categories: [],
  subcategoryMap: new Map(),
  tagIndex: [],
  domainIndex: [],
  savedViews: []
};

function setLayout(layout: 'list' | 'grid') {
  state.filters.layout = layout;
  cardsContainer.classList.toggle('cards--grid', layout === 'grid');
  cardsContainer.classList.toggle('cards--list', layout === 'list');
  listToggle.classList.toggle('active', layout === 'list');
  gridToggle.classList.toggle('active', layout === 'grid');
  render();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function applyFilters(): LinkItem[] {
  return filterLinks(state.links, state.filters);
}

function renderSummary(count: number) {
  const filtersActive = hasActiveFilters();
  const parts: string[] = [];

  if (state.filters.category) {
    parts.push(`Category: ${state.filters.category}`);
  }
  if (state.filters.subcategory) {
    parts.push(`Subcategory: ${state.filters.subcategory}`);
  }
  if (state.filters.tags.length) {
    parts.push(`Tags: ${state.filters.tags.join(', ')}`);
  }
  if (state.filters.domains.length) {
    parts.push(`Domains: ${state.filters.domains.join(', ')}`);
  }
  if (state.filters.dateRange?.from || state.filters.dateRange?.to) {
    const from = state.filters.dateRange.from ? new Date(state.filters.dateRange.from).toLocaleDateString() : '…';
    const to = state.filters.dateRange.to ? new Date(state.filters.dateRange.to).toLocaleDateString() : '…';
    parts.push(`Date: ${from} – ${to}`);
  }

  const label = filtersActive ? 'Filtered count' : 'Total bookmarks';
  const detail = parts.length ? ` (${parts.join(', ')})` : '';
  summaryElement.textContent = `${label}: ${count} ${count === 1 ? 'link' : 'links'}${detail}`;
}

function clearChildren(element: Element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderCards(links: LinkItem[]) {
  clearChildren(cardsContainer);
  if (!links.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No results match the current filters.';
    cardsContainer.appendChild(empty);
    return;
  }

  for (const link of links) {
    const fragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
    const article = fragment.querySelector('.card') as HTMLElement;
    const titleAnchor = fragment.querySelector('.card__title') as HTMLAnchorElement;
    const deleteButton = fragment.querySelector('.card__delete') as HTMLButtonElement;
    const openButton = fragment.querySelector('.card__open') as HTMLButtonElement;
    const editButton = fragment.querySelector('.card__edit') as HTMLButtonElement;
    const summary = fragment.querySelector('.card__summary') as HTMLElement;
    const domain = fragment.querySelector('.card__domain') as HTMLElement;
    const date = fragment.querySelector('.card__date') as HTMLElement;
    const tagsContainer = fragment.querySelector('.card__tags') as HTMLElement;

    article.dataset.linkId = link.id;
    titleAnchor.href = link.url;
    titleAnchor.textContent = link.title || link.url;
    summary.textContent = link.summary || 'No summary available yet.';
    domain.textContent = link.domain;
    date.textContent = formatDate(link.createdAt || link.updatedAt);

    clearChildren(tagsContainer);
    for (const tag of link.tags) {
      const chip = document.createElement('span');
      chip.className = 'card__tag';
      chip.textContent = tag;
      tagsContainer.appendChild(chip);
    }

    openButton.addEventListener('click', () => {
      chrome.tabs.create({ url: link.url });
    });

    editButton.addEventListener('click', async () => {
      const tab = await chrome.tabs.create({ url: link.url, active: true });
      if (tab.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      try {
        await chrome.action.openPopup();
      } catch (error) {
        console.warn('Unable to open popup automatically', error);
      }
    });

    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm('Remove this bookmark?');
      if (!confirmed) {
        return;
      }
      await removeLink(link.id);
      await refreshState();
    });

    cardsContainer.appendChild(fragment);
  }
}

function renderCategorySelect() {
  clearChildren(categorySelect);
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All categories';
  categorySelect.appendChild(allOption);
  for (const category of state.categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    if (state.filters.category === category) {
      option.selected = true;
    }
    categorySelect.appendChild(option);
  }
}

function renderSubcategories() {
  clearChildren(subcategoryContainer);
  const category = state.filters.category;
  const subcategories = category ? state.subcategoryMap.get(category) || [] : [];

  if (!subcategories.length) {
    const hint = document.createElement('p');
    hint.className = 'empty-state';
    hint.textContent = category ? 'No subcategories saved yet.' : 'Select a category to filter subcategories.';
    subcategoryContainer.appendChild(hint);
    return;
  }

  for (const subcategory of subcategories) {
    const chip = createChip(subcategory, state.filters.subcategory === subcategory);
    chip.addEventListener('click', () => {
      state.filters.subcategory = state.filters.subcategory === subcategory ? undefined : subcategory;
      render();
    });
    subcategoryContainer.appendChild(chip);
  }
}

function renderTagFilters() {
  clearChildren(tagContainer);
  for (const tag of state.tagIndex) {
    const chip = createChip(tag, state.filters.tags.includes(tag));
    chip.addEventListener('click', () => {
      toggleArrayValue(state.filters.tags, tag);
      render();
    });
    tagContainer.appendChild(chip);
  }
}

function renderDomainFilters() {
  clearChildren(domainContainer);
  for (const domain of state.domainIndex) {
    const chip = createChip(domain, state.filters.domains.includes(domain));
    chip.addEventListener('click', () => {
      toggleArrayValue(state.filters.domains, domain);
      render();
    });
    domainContainer.appendChild(chip);
  }
}

function renderSavedViews() {
  clearChildren(savedViewsContainer);
  const recentChip = createChip('Recent', state.activeViewId === 'recent');
  recentChip.addEventListener('click', () => {
    state.activeViewId = 'recent';
    applySavedFilters({
      text: '',
      category: undefined,
      subcategory: undefined,
      tags: [],
      domains: [],
      layout: state.filters.layout,
      dateRange: undefined
    });
  });
  savedViewsContainer.appendChild(recentChip);

  for (const view of state.savedViews) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chip-view';

    const chip = createChip(view.name, state.activeViewId === view.id);
    chip.addEventListener('click', () => {
      state.activeViewId = view.id;
      applySavedFilters(view.filters);
    });
    wrapper.appendChild(chip);

    const remove = document.createElement('button');
    remove.className = 'chip-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Delete view ${view.name}`;
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      await deleteFilterView(view.id);
      await refreshState();
    });
    wrapper.appendChild(remove);

    savedViewsContainer.appendChild(wrapper);
  }
}

function renderActiveFilters() {
  clearChildren(viewChipsContainer);
  const filters: Array<{ label: string; value: string; clear: () => void }> = [];

  if (state.filters.category) {
    filters.push({ label: 'Category', value: state.filters.category, clear: () => {
      state.filters.category = undefined;
      state.filters.subcategory = undefined;
    }});
  }
  if (state.filters.subcategory) {
    filters.push({ label: 'Subcategory', value: state.filters.subcategory, clear: () => {
      state.filters.subcategory = undefined;
    }});
  }
  for (const tag of state.filters.tags) {
    filters.push({ label: 'Tag', value: tag, clear: () => toggleArrayValue(state.filters.tags, tag) });
  }
  for (const domain of state.filters.domains) {
    filters.push({ label: 'Domain', value: domain, clear: () => toggleArrayValue(state.filters.domains, domain) });
  }
  if (state.filters.dateRange?.from || state.filters.dateRange?.to) {
    filters.push({
      label: 'Date',
      value: `${state.filters.dateRange.from || '…'} → ${state.filters.dateRange.to || '…'}`,
      clear: () => {
        if (state.filters.dateRange) {
          state.filters.dateRange.from = undefined;
          state.filters.dateRange.to = undefined;
        }
        dateFromInput.value = '';
        dateToInput.value = '';
      }
    });
  }

  if (!filters.length) {
    return;
  }

  for (const filter of filters) {
    const chip = createChip(`${filter.label}: ${filter.value}`, false);
    chip.addEventListener('click', () => {
      filter.clear();
      render();
    });
    viewChipsContainer.appendChild(chip);
  }
}

function createChip(label: string, active: boolean): HTMLButtonElement {
  const fragment = chipTemplate.content.cloneNode(true) as DocumentFragment;
  const button = fragment.firstElementChild as HTMLButtonElement;
  button.textContent = label;
  button.classList.toggle('active', active);
  return button;
}

function toggleArrayValue(array: string[], value: string) {
  const index = array.indexOf(value);
  if (index >= 0) {
    array.splice(index, 1);
  } else {
    array.push(value);
  }
}

function applySavedFilters(filters: FilterState) {
  state.filters.text = filters.text || '';
  state.filters.category = filters.category;
  state.filters.subcategory = filters.subcategory;
  state.filters.tags = [...(filters.tags || [])];
  state.filters.domains = [...(filters.domains || [])];
  state.filters.layout = filters.layout || state.filters.layout;
  state.filters.dateRange = filters.dateRange ? { ...filters.dateRange } : undefined;

  textInput.value = state.filters.text;
  dateFromInput.value = state.filters.dateRange?.from || '';
  dateToInput.value = state.filters.dateRange?.to || '';

  setLayout(state.filters.layout);
  render();
}

async function refreshState() {
  const appState = await loadAppState();
  state.links = appState.links;
  state.categories = unique(appState.links.map((link) => link.category)).sort((a, b) => a.localeCompare(b));
  state.subcategoryMap = new Map();
  for (const link of appState.links) {
    if (!state.subcategoryMap.has(link.category)) {
      state.subcategoryMap.set(link.category, []);
    }
    if (link.subcategory) {
      const list = state.subcategoryMap.get(link.category)!;
      if (!list.includes(link.subcategory)) {
        list.push(link.subcategory);
      }
    }
  }
  for (const list of state.subcategoryMap.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }
  state.tagIndex = [...appState.tagIndex].sort((a, b) => a.localeCompare(b));
  state.domainIndex = unique(appState.links.map((link) => link.domain)).sort((a, b) => a.localeCompare(b));
  state.savedViews = appState.savedViews || [];

  renderCategorySelect();
  renderSubcategories();
  renderTagFilters();
  renderDomainFilters();
  renderSavedViews();
  render();
}

function render() {
  const links = applyFilters();
  renderSummary(links.length);
  renderActiveFilters();
  renderSubcategories();
  renderCards(links);
}

function hasActiveFilters(): boolean {
  const filters = state.filters;
  if (filters.text && filters.text.trim()) {
    return true;
  }
  if (filters.category || filters.subcategory) {
    return true;
  }
  if (filters.tags.length || filters.domains.length) {
    return true;
  }
  if (filters.dateRange && (filters.dateRange.from || filters.dateRange.to)) {
    return true;
  }
  return false;
}

async function saveCurrentView() {
  const name = viewNameInput.value.trim();
  if (!name) {
    window.alert('Enter a view name.');
    return;
  }
  const filters: FilterState = {
    text: state.filters.text,
    category: state.filters.category,
    subcategory: state.filters.subcategory,
    tags: [...state.filters.tags],
    domains: [...state.filters.domains],
    layout: state.filters.layout,
    dateRange: state.filters.dateRange ? { ...state.filters.dateRange } : undefined
  };
  await saveFilterView(name, filters);
  viewNameInput.value = '';
  await refreshState();
}

textInput.addEventListener('input', () => {
  state.filters.text = textInput.value;
  render();
});

categorySelect.addEventListener('change', () => {
  state.filters.category = categorySelect.value || undefined;
  state.filters.subcategory = undefined;
  renderCategorySelect();
  render();
});

dateFromInput.addEventListener('change', () => {
  state.filters.dateRange = state.filters.dateRange || {};
  state.filters.dateRange.from = dateFromInput.value || undefined;
  render();
});

dateToInput.addEventListener('change', () => {
  state.filters.dateRange = state.filters.dateRange || {};
  state.filters.dateRange.to = dateToInput.value || undefined;
  render();
});

saveViewButton.addEventListener('click', saveCurrentView);

viewNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCurrentView();
  }
});

listToggle.addEventListener('click', () => setLayout('list'));
gridToggle.addEventListener('click', () => setLayout('grid'));

openDefaultButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.google.com/webhp?source=smartbookmark' });
});

async function refreshPreferences() {
  const prefs = await loadPreferences();
  overrideBanner.hidden = prefs.replaceNewTab !== false ? true : false;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.SMART_BOOKMARK_APP_STATE) {
    refreshState();
  }
  if (area === 'sync' && changes.SMART_BOOKMARK_PREFERENCES) {
    refreshPreferences();
  }
});

refreshState();
setLayout(state.filters.layout);
refreshPreferences();
