import { inArray, and, isNotNull, gte } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles } from "../db/schema.js";
import type { IdentityHeaders } from "./google.js";
import { extractMetadataFromMarkdown, type ExtractedAuthor } from "./llm.js";

export interface ExtractResultSuccess {
  url: string;
  success: true;
  authors: ExtractedAuthor[];
  publishedAt: string | null;
}

interface ExtractResultError {
  url: string;
  success: false;
  error: string;
}

export type ExtractResult = ExtractResultSuccess | ExtractResultError;

const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

interface ScrapeResponse {
  cached: boolean;
  result: {
    id: string;
    url: string;
    rawMarkdown: string | null;
  };
}

async function scrapeMarkdown(
  url: string,
  headers: IdentityHeaders,
): Promise<string | null> {
  const baseUrl = process.env.SCRAPING_SERVICE_URL;
  const apiKey = process.env.SCRAPING_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("SCRAPING_SERVICE_URL and SCRAPING_SERVICE_API_KEY must be set");
  }

  const res = await fetch(`${baseUrl}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "x-org-id": headers.orgId,
      "x-user-id": headers.userId,
      "x-run-id": headers.runId,
      ...(headers.workflowName ? { "x-workflow-name": headers.workflowName } : {}),
      ...(headers.featureSlug ? { "x-feature-slug": headers.featureSlug } : {}),
      ...(headers.brandId ? { "x-brand-id": headers.brandId } : {}),
      ...(headers.campaignId ? { "x-campaign-id": headers.campaignId } : {}),
    },
    body: JSON.stringify({
      url,
      options: { formats: ["markdown"], onlyMainContent: true },
    }),
  });

  if (!res.ok) {
    console.error(`[Articles Service] Scrape failed for ${url}: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as ScrapeResponse;
  return data.result?.rawMarkdown ?? null;
}

/**
 * Parse a stored author string back into ExtractedAuthor[].
 * Format in DB: "type:firstName lastName, type:firstName lastName"
 * Falls back to legacy format "firstName lastName" (assumes person).
 */
function parseStoredAuthors(authorStr: string): ExtractedAuthor[] {
  if (!authorStr) return [];
  return authorStr.split(", ").map((entry) => {
    const typePrefixMatch = entry.match(/^(person|organization):/);
    const type = (typePrefixMatch?.[1] ?? "person") as "person" | "organization";
    const name = typePrefixMatch ? entry.slice(typePrefixMatch[0].length) : entry;
    const parts = name.trim().split(" ");
    return {
      type,
      firstName: parts.slice(0, -1).join(" ") || "",
      lastName: parts[parts.length - 1] || "",
    };
  });
}

/**
 * Serialize ExtractedAuthor[] for DB storage.
 * Format: "type:firstName lastName, type:firstName lastName"
 */
export function serializeAuthors(authors: ExtractedAuthor[]): string {
  return authors
    .map((a) => `${a.type}:${a.firstName ? a.firstName + " " : ""}${a.lastName}`)
    .join(", ");
}

export async function extractArticles(
  urls: string[],
  headers: IdentityHeaders,
): Promise<ExtractResult[]> {
  if (urls.length === 0) return [];

  // Step 1: Check DB cache — skip URLs already extracted within 6 months
  const cacheThreshold = new Date(Date.now() - CACHE_TTL_MS);
  const cachedArticles = await db
    .select({
      articleUrl: articles.articleUrl,
      author: articles.author,
      articlePublished: articles.articlePublished,
    })
    .from(articles)
    .where(
      and(
        inArray(articles.articleUrl, urls),
        isNotNull(articles.extractedAt),
        gte(articles.extractedAt, cacheThreshold),
      ),
    );

  const cachedByUrl = new Map(
    cachedArticles.map((a) => [a.articleUrl, a]),
  );

  const results: ExtractResult[] = [];

  // Return cached results
  for (const cached of cachedArticles) {
    results.push({
      url: cached.articleUrl,
      success: true,
      authors: cached.author ? parseStoredAuthors(cached.author) : [],
      publishedAt: cached.articlePublished ?? null,
    });
  }

  // Step 2: For cache misses, scrape markdown + extract via Haiku
  const urlsToExtract = urls.filter((u) => !cachedByUrl.has(u));

  if (urlsToExtract.length === 0) {
    console.log(`[Articles Service] All ${urls.length} URLs served from cache`);
    return results;
  }

  console.log(
    `[Articles Service] Cache hit: ${cachedArticles.length}/${urls.length}, extracting ${urlsToExtract.length} new URLs via scrape+Haiku`,
  );

  // Scrape all URLs in parallel
  const scrapeResults = await Promise.allSettled(
    urlsToExtract.map(async (url) => {
      const markdown = await scrapeMarkdown(url, headers);
      return { url, markdown };
    }),
  );

  // Extract metadata via Haiku for each scraped page
  await Promise.allSettled(
    scrapeResults.map(async (scrapeResult) => {
      if (scrapeResult.status === "rejected") {
        return;
      }
      const { url, markdown } = scrapeResult.value;
      if (!markdown) {
        results.push({ url, success: false, error: "Failed to scrape page" });
        return;
      }

      try {
        const metadata = await extractMetadataFromMarkdown(markdown, headers);
        if (!metadata.isArticle) {
          results.push({ url, success: false, error: "Page is not a press article" });
          return;
        }
        results.push({
          url,
          success: true,
          authors: metadata.authors,
          publishedAt: metadata.publishedAt,
        });
      } catch (err) {
        console.error(`[Articles Service] LLM extraction failed for ${url}:`, err);
        results.push({
          url,
          success: false,
          error: err instanceof Error ? err.message : "LLM extraction failed",
        });
      }
    }),
  );

  return results;
}
