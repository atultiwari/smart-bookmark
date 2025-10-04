import { heuristicClassify } from './heuristics.js';
import { loadPreferences } from './storage.js';
import { Preferences } from './types.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type ClassificationInput = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  categories: string[];
};

export type ClassificationResult = {
  summary: string;
  category: string;
  subcategory?: string;
  tags: string[];
  rationale?: string;
  usedLLM: boolean;
  reason?: 'missing-key' | 'error' | 'fallback';
  errorMessage?: string;
};

function summarizeFallback(snippet: string): string {
  const normalized = snippet.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 280) {
    return normalized;
  }
  return `${normalized.slice(0, 277)}…`;
}

function parseGeminiJson(text: string | undefined): Partial<ClassificationResult> | null {
  if (!text) {
    return null;
  }

  const sanitized = text
    .replace(/```json\s*/i, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(sanitized);
  } catch (error) {
    console.warn('Gemini response was not valid JSON', error);
    return null;
  }
}

function buildPrompt(input: ClassificationInput): string {
  const snippet = input.snippet.replace(/\s+/g, ' ').slice(0, 2000);
  const categoriesSection = input.categories?.length
    ? `Existing categories:\n${input.categories.map((name, index) => `${index + 1}. ${name}`).join('\n')}\n`
    : '';
  return [
    'You are organizing research bookmarks for a clinician-AI researcher.',
    categoriesSection || '',
    categoriesSection
      ? 'When possible, align with an existing category; only propose a new one if it meaningfully differs.'
      : 'When possible, align with existing categories the user already has; only propose a new one if no close match exists.',
    `Given: ${input.title}`,
    `URL: ${input.url}`,
    `visibleTextSnippet: ${snippet}`,
    'Return JSON with:',
    'summary (≤ 280 chars, factual)',
    'category (one of existing if close; else a new, sensible label)',
    'subcategory (optional)',
    'tags (3–8 concise keywords)',
    'rationale (one sentence; not stored)',
    'Only output valid JSON.'
  ].join('\n');
}

async function callGemini(apiKey: string, model: string, input: ClassificationInput): Promise<Partial<ClassificationResult> | null> {
  const prompt = buildPrompt(input);

  const endpoint = `${GEMINI_BASE}/${model}:generateContent`;

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const textResponse: string | undefined = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text: string }) => part.text)
    .join('\n');

  return parseGeminiJson(textResponse);
}

function buildFallback(
  input: ClassificationInput,
  preferences: Preferences,
  reason: ClassificationResult['reason'] = 'fallback',
  errorMessage?: string
): ClassificationResult {
  const classification = heuristicClassify({
    title: input.title,
    content: input.snippet,
    domain: input.domain,
    preferences
  });

  return {
    summary: summarizeFallback(input.snippet),
    category: classification.category,
    subcategory: classification.subcategory,
    tags: classification.tags,
    rationale: undefined,
    usedLLM: false,
    reason,
    errorMessage
  };
}

export async function classifyWithLLM(input: ClassificationInput): Promise<ClassificationResult> {
  const preferences = await loadPreferences();
  const apiKey = preferences.geminiApiKey?.trim();
  const model = preferences.geminiModel?.trim() || 'gemini-2.5-flash';

  if (!apiKey) {
    return buildFallback(input, preferences, 'missing-key');
  }

  try {
    const response = await callGemini(apiKey, model, input);
    if (response?.summary && response?.category) {
      return {
        summary: response.summary,
        category: response.category,
        subcategory: response.subcategory,
        tags: Array.isArray(response.tags) ? response.tags.map(String).slice(0, 8) : [],
        rationale: response.rationale,
        usedLLM: true
      };
    }
    return buildFallback(input, preferences, 'error', 'Gemini did not return structured data.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Gemini request failed; using heuristic fallback instead.', error);
    return buildFallback(input, preferences, 'error', message);
  }
}
