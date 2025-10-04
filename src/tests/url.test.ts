import assert from 'node:assert/strict';
import { test } from './test-helpers.js';
import { canonicalizeUrl, sameCanonicalUrl } from '../lib/url.js';

test('canonicalizeUrl removes tracking parameters and trailing slash', () => {
  const input = 'https://www.example.com/article/?utm_source=newsletter&ref=home/';
  const output = canonicalizeUrl(input);
  assert.equal(output, 'https://example.com/article?ref=home');
});

test('canonicalizeUrl normalizes fragments and default ports', () => {
  const input = 'http://Example.com:80/path/#section-2';
  const output = canonicalizeUrl(input);
  assert.equal(output, 'http://example.com/path');
});

test('sameCanonicalUrl collapses equivalent URLs with tracking fragments', () => {
  const a = 'https://medium.com/pathology/article?utm_campaign=123';
  const b = 'https://medium.com/pathology/article#overview';
  assert.equal(sameCanonicalUrl(a, b), true);
});
