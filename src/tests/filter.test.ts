import assert from 'node:assert/strict';
import { test } from './test-helpers.js';
import { filterLinks, matchesTags } from '../lib/filtering.js';
import { FilterState, LinkItem } from '../lib/types.js';

const sampleLinks: LinkItem[] = [
  {
    id: '1',
    url: 'https://example.com/a',
    domain: 'example.com',
    title: 'AI in Pathology',
    summary: 'Exploring AI tools for pathology diagnostics.',
    createdAt: '2024-05-10T12:00:00.000Z',
    category: 'Pathology',
    tags: ['AI', 'Healthcare'],
    urlHash: 'hash-1'
  },
  {
    id: '2',
    url: 'https://example.com/b',
    domain: 'example.com',
    title: 'Deep learning basics',
    summary: 'Introduction to neural networks.',
    createdAt: '2024-05-11T12:00:00.000Z',
    category: 'Deep Learning',
    tags: ['AI', 'Education'],
    urlHash: 'hash-2'
  },
  {
    id: '3',
    url: 'https://another.org/c',
    domain: 'another.org',
    title: 'Healthcare regulations',
    summary: 'Policy overview.',
    createdAt: '2024-05-12T12:00:00.000Z',
    category: 'Healthcare',
    tags: ['Policy'],
    urlHash: 'hash-3'
  }
];

test('matchesTags enforces AND semantics', () => {
  assert.equal(matchesTags(sampleLinks[0], ['AI', 'Healthcare']), true);
  assert.equal(matchesTags(sampleLinks[0], ['AI', 'Policy']), false);
});

test('filterLinks applies combined filters', () => {
  const filters: FilterState = {
    text: 'ai',
    category: 'Pathology',
    subcategory: undefined,
    tags: ['AI', 'Healthcare'],
    domains: [],
    layout: 'list'
  };

  const results = filterLinks(sampleLinks, filters);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, '1');
});
