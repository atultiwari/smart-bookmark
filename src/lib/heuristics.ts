import { Preferences } from './types.js';

const KEYWORD_MAP: Record<string, string[]> = {
  Pathology: ['pathology', 'histology', 'biopsy', 'cytopathology', 'digital pathology'],
  Healthcare: ['healthcare', 'medical', 'patient', 'clinical', 'hospital'],
  'Artificial Intelligence': ['artificial intelligence', 'ai', 'machine learning', 'ml'],
  'Deep Learning': ['deep learning', 'neural network', 'transformer', 'llm'],
  'Computer Vision': ['computer vision', 'image recognition', 'object detection', 'segmentation'],
  Games: ['game', 'gaming', 'gamedev', 'unity', 'unreal'],
  '3D Animation': ['animation', 'render', '3d', 'blender', 'maya'],
  'AI in Pathology': ['digital pathology', 'whole slide', 'wsis', 'diagnostic ai'],
  'AI-assisted Films': ['generative video', 'ai film', 'cinematic ai', 'storyboard'],
  'AI in Healthcare': ['ai healthcare', 'clinical decision support', 'medical ai']
};

function normalize(text: string | undefined): string {
  return (text || '').toLowerCase();
}

export type HeuristicInput = {
  title?: string;
  content?: string;
  domain?: string;
  preferences: Preferences;
};

export function heuristicClassify(input: HeuristicInput): {
  category: string;
  subcategory?: string;
  tags: string[];
} {
  const haystack = `${input.title || ''}\n${input.content || ''}\n${input.domain || ''}`.toLowerCase();
  const presets = input.preferences.interests || [];

  for (const interest of presets) {
    if (haystack.includes(interest.toLowerCase())) {
      return {
        category: interest,
        subcategory: undefined,
        tags: suggestTags(haystack, input.preferences)
      };
    }
  }

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return {
        category,
        subcategory: undefined,
        tags: suggestTags(haystack, input.preferences)
      };
    }
  }

  return {
    category: 'Unsorted',
    subcategory: undefined,
    tags: suggestTags(haystack, input.preferences)
  };
}

function suggestTags(haystack: string, preferences: Preferences): string[] {
  const tags = new Set<string>();

  for (const preset of preferences.tagPresets || []) {
    if (haystack.includes(preset.toLowerCase())) {
      tags.add(titleCase(preset));
    }
  }

  for (const interest of preferences.interests || []) {
    if (haystack.includes(interest.toLowerCase()) && tags.size < 5) {
      tags.add(titleCase(interest));
    }
  }

  return Array.from(tags).slice(0, 5);
}

function titleCase(value: string): string {
  if (!value) {
    return value;
  }
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
