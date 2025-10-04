import assert from 'node:assert/strict';
import { test } from './test-helpers.js';
import { migrateAppState } from '../lib/storage.js';
import { SCHEMA_VERSION } from '../lib/types.js';

test('migrateAppState upgrades legacy schema to v2 with defaults', async () => {
  const legacy = {
    entries: [
      {
        id: '1',
        url: 'https://example.com/article?utm_source=news',
        title: 'Legacy title',
        categoryId: 'cat-1'
      }
    ],
    categories: [
      { id: 'cat-1', name: 'Pathology' }
    ]
  };

  const migrated = await migrateAppState(legacy);
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.links.length, 1);
  const [link] = migrated.links;
  assert.equal(link.category, 'Pathology');
  assert.equal(link.tags.length, 0);
  assert.equal(link.url, 'https://example.com/article');
  assert.ok(link.urlHash.length > 10);
  assert.equal(migrated.categories.some((cat) => cat.name === 'Unsorted'), true);
});
