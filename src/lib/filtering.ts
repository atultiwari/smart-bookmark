import { FilterState, LinkItem } from './types.js';

export function matchesTags(link: LinkItem, tags: string[]): boolean {
  if (!tags.length) {
    return true;
  }
  const linkTags = new Set(link.tags.map((tag) => tag.toLowerCase()));
  return tags.every((tag) => linkTags.has(tag.toLowerCase()));
}

function matchesText(link: LinkItem, text: string): boolean {
  if (!text) {
    return true;
  }
  const haystack = `${link.title} ${link.summary || ''} ${link.tags.join(' ')} ${link.domain}`.toLowerCase();
  return haystack.includes(text.toLowerCase());
}

function matchesCategory(link: LinkItem, category?: string): boolean {
  if (!category) {
    return true;
  }
  return link.category.toLowerCase() === category.toLowerCase();
}

function matchesSubcategory(link: LinkItem, subcategory?: string): boolean {
  if (!subcategory) {
    return true;
  }
  return (link.subcategory || '').toLowerCase() === subcategory.toLowerCase();
}

function matchesDomains(link: LinkItem, domains: string[]): boolean {
  if (!domains.length) {
    return true;
  }
  return domains.some((domain) => link.domain === domain);
}

function matchesDate(link: LinkItem, from?: string, to?: string): boolean {
  const created = new Date(link.createdAt || link.updatedAt || '').getTime();
  if (Number.isNaN(created)) {
    return true;
  }
  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isNaN(fromTime) && created < fromTime) {
      return false;
    }
  }
  if (to) {
    const toTime = new Date(to).getTime();
    if (!Number.isNaN(toTime) && created > toTime + 24 * 60 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

export function filterLinks(links: LinkItem[], filters: FilterState): LinkItem[] {
  const { text, category, subcategory, tags, domains, dateRange } = filters;
  return links
    .filter((link) =>
      matchesText(link, text) &&
      matchesCategory(link, category) &&
      matchesSubcategory(link, subcategory) &&
      matchesTags(link, tags) &&
      matchesDomains(link, domains) &&
      matchesDate(link, dateRange?.from, dateRange?.to)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
