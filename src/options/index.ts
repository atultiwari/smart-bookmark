import {
  loadAppState,
  loadPreferences,
  migrateAppState,
  resetAppState,
  saveAppState,
  savePreferences
} from '../lib/storage.js';
import { Preferences } from '../lib/types.js';

const geminiInput = document.getElementById('gemini-key') as HTMLInputElement;
const saveGeminiButton = document.getElementById('save-gemini') as HTMLButtonElement;
const toggleGeminiButton = document.getElementById('toggle-gemini') as HTMLButtonElement;
const geminiStatus = document.getElementById('gemini-status') as HTMLElement;
const geminiModelInput = document.getElementById('gemini-model') as HTMLInputElement;
const saveModelButton = document.getElementById('save-model') as HTMLButtonElement;

const interestList = document.getElementById('interest-list') as HTMLElement;
const interestInput = document.getElementById('interest-input') as HTMLInputElement;
const addInterestButton = document.getElementById('add-interest') as HTMLButtonElement;

const tagPresetList = document.getElementById('tag-preset-list') as HTMLElement;
const tagPresetInput = document.getElementById('tag-preset-input') as HTMLInputElement;
const addTagPresetButton = document.getElementById('add-tag-preset') as HTMLButtonElement;

const subcategoryPresetList = document.getElementById('subcategory-preset-list') as HTMLElement;
const subcategoryPresetInput = document.getElementById('subcategory-preset-input') as HTMLInputElement;
const addSubcategoryPresetButton = document.getElementById('add-subcategory-preset') as HTMLButtonElement;

const replaceNewTabToggle = document.getElementById('replace-newtab') as HTMLInputElement;

const exportButton = document.getElementById('export-data') as HTMLButtonElement;
const importInput = document.getElementById('import-file') as HTMLInputElement;
const clearButton = document.getElementById('clear-data') as HTMLButtonElement;
const dataStatus = document.getElementById('data-status') as HTMLElement;

const chipTemplate = document.getElementById('chip-template') as HTMLTemplateElement;

let preferences: Preferences | null = null;
let showGemini = false;

function renderChip(container: HTMLElement, value: string, onRemove: () => void) {
  const fragment = chipTemplate.content.cloneNode(true) as DocumentFragment;
  const chip = fragment.firstElementChild as HTMLElement;
  const label = chip.querySelector('.chip__label') as HTMLElement;
  const remove = chip.querySelector('.chip__remove') as HTMLButtonElement;
  label.textContent = value;
  remove.addEventListener('click', onRemove);
  container.appendChild(chip);
}

function renderLists() {
  if (!preferences) {
    return;
  }
  interestList.innerHTML = '';
  for (const interest of preferences.interests) {
    renderChip(interestList, interest, () => removeFromList(preferences!.interests, interest));
  }

  tagPresetList.innerHTML = '';
  for (const tag of preferences.tagPresets) {
    renderChip(tagPresetList, tag, () => removeFromList(preferences!.tagPresets, tag));
  }

  subcategoryPresetList.innerHTML = '';
  for (const subcategory of preferences.subcategoryPresets) {
    renderChip(subcategoryPresetList, subcategory, () => removeFromList(preferences!.subcategoryPresets, subcategory));
  }
}

function removeFromList(list: string[], value: string) {
  const index = list.findIndex((item) => item.toLowerCase() === value.toLowerCase());
  if (index >= 0) {
    list.splice(index, 1);
    persistPreferences();
  }
}

async function persistPreferences() {
  if (!preferences) {
    return;
  }
  await savePreferences(preferences);
  renderLists();
}

function addToList(list: string[], value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  if (!list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    list.push(trimmed);
    list.sort((a, b) => a.localeCompare(b));
    persistPreferences();
  }
}

async function init() {
  preferences = await loadPreferences();
  geminiInput.value = preferences.geminiApiKey ?? '';
  geminiModelInput.value = preferences.geminiModel || 'gemini-2.5-flash';
  replaceNewTabToggle.checked = !!preferences.replaceNewTab;
  renderLists();
}

saveGeminiButton.addEventListener('click', async () => {
  if (!preferences) {
    return;
  }
  const key = geminiInput.value.trim();
  preferences.geminiApiKey = key || undefined;
  geminiStatus.textContent = 'Saving…';
  await persistPreferences();
  geminiStatus.textContent = key ? 'Gemini key saved.' : 'Key cleared.';
});

toggleGeminiButton.addEventListener('click', () => {
  showGemini = !showGemini;
  geminiInput.type = showGemini ? 'text' : 'password';
  toggleGeminiButton.textContent = showGemini ? 'Hide' : 'Show';
});

saveModelButton.addEventListener('click', async () => {
  if (!preferences) {
    return;
  }
  const model = geminiModelInput.value.trim() || 'gemini-2.5-flash';
  preferences.geminiModel = model;
  geminiStatus.textContent = 'Model saved.';
  await persistPreferences();
});

addInterestButton.addEventListener('click', () => {
  if (!preferences) {
    return;
  }
  addToList(preferences.interests, interestInput.value);
  interestInput.value = '';
});

interestInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addInterestButton.click();
  }
});

addTagPresetButton.addEventListener('click', () => {
  if (!preferences) {
    return;
  }
  addToList(preferences.tagPresets, tagPresetInput.value);
  tagPresetInput.value = '';
});

tagPresetInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTagPresetButton.click();
  }
});

addSubcategoryPresetButton.addEventListener('click', () => {
  if (!preferences) {
    return;
  }
  addToList(preferences.subcategoryPresets, subcategoryPresetInput.value);
  subcategoryPresetInput.value = '';
});

subcategoryPresetInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addSubcategoryPresetButton.click();
  }
});

replaceNewTabToggle.addEventListener('change', async () => {
  if (!preferences) {
    return;
  }
  preferences.replaceNewTab = replaceNewTabToggle.checked;
  await persistPreferences();
});

exportButton.addEventListener('click', async () => {
  dataStatus.textContent = 'Preparing export…';
  const state = await loadAppState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `smart-bookmark-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  dataStatus.textContent = 'Export complete.';
});

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  if (!file) {
    return;
  }
  dataStatus.textContent = 'Importing…';
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const migrated = await migrateAppState(parsed);
    await saveAppState(migrated);
    dataStatus.textContent = 'Import successful.';
  } catch (error) {
    console.error('Import failed', error);
    dataStatus.textContent = 'Import failed. Ensure the file is valid JSON.';
  } finally {
    importInput.value = '';
  }
});

clearButton.addEventListener('click', async () => {
  const confirmed = window.confirm('Clear all saved links, categories, and views?');
  if (!confirmed) {
    return;
  }
  await resetAppState();
  dataStatus.textContent = 'All data cleared.';
});

init();
