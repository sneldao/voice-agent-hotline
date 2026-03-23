// ============================================
// Firecrawl Integration
// ============================================
// Provides web search and content extraction via Firecrawl Search API.
// Uses the REST API directly to avoid SDK compatibility issues with Next.js.

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2';

// ============================================
// Types
// ============================================

export interface FirecrawlSearchResult {
  title: string;
  url: string;
  snippet: string;
  markdown?: string;
  source: string;
}

export interface FirecrawlSearchResponse {
  query: string;
  results: FirecrawlSearchResult[];
  totalResults: number;
}

// ============================================
// Helpers
// ============================================

function getApiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not configured');
  return key;
}

async function firecrawlFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${FIRECRAWL_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ============================================
// Public API
// ============================================

/**
 * Search the web using Firecrawl Search API.
 * Returns clean, LLM-ready results with optional scraped content.
 */
export async function firecrawlSearch(
  query: string,
  options?: {
    limit?: number;
    scrapeContent?: boolean;
    country?: string;
    lang?: string;
  }
): Promise<FirecrawlSearchResponse> {
  const limit = options?.limit ?? 5;

  const body: Record<string, unknown> = { query, limit };

  if (options?.scrapeContent) {
    body.scrapeOptions = { formats: ['markdown'] };
  }
  if (options?.country) body.country = options.country;
  if (options?.lang) body.lang = options.lang;

  const response = await firecrawlFetch<any>('/search', body);

  // API returns { success: true, data: { web: [...] } }
  const webResults = response.data?.web ?? response.web ?? [];

  const results: FirecrawlSearchResult[] = webResults.map((item: any) => ({
    title: item.title ?? '',
    url: item.url ?? '',
    snippet: item.description ?? item.snippet ?? '',
    markdown: item.markdown ?? undefined,
    source: item.url ? new URL(item.url).hostname : 'unknown',
  }));

  return { query, results, totalResults: results.length };
}

/**
 * Scrape a single URL and return clean markdown content.
 */
export async function firecrawlScrape(
  url: string
): Promise<{ url: string; title: string; markdown: string }> {
  const response = await firecrawlFetch<any>('/scrape', {
    url,
    formats: ['markdown'],
  });

  // API returns { success: true, data: { markdown, metadata } }
  const data = response.data ?? response;

  return {
    url: data.metadata?.sourceURL ?? url,
    title: data.metadata?.title ?? '',
    markdown: data.markdown ?? '',
  };
}
