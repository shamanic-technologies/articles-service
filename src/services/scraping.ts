import type { IdentityHeaders } from "./google.js";

interface ExtractAuthor {
  firstName: string;
  lastName: string;
}

export interface ExtractResultSuccess {
  url: string;
  success: true;
  authors: ExtractAuthor[];
  publishedAt: string | null;
}

interface ExtractResultError {
  url: string;
  success: false;
  error: string;
}

export type ExtractResult = ExtractResultSuccess | ExtractResultError;

interface ExtractResponse {
  results: ExtractResult[];
  tokensUsed?: number;
  runId?: string;
}

export async function extractArticles(
  urls: string[],
  headers: IdentityHeaders,
): Promise<ExtractResult[]> {
  const baseUrl = process.env.SCRAPING_SERVICE_URL;
  const apiKey = process.env.SCRAPING_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("SCRAPING_SERVICE_URL and SCRAPING_SERVICE_API_KEY must be set");
  }

  const res = await fetch(`${baseUrl}/extract`, {
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
    body: JSON.stringify({ urls }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Scraping extract failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as ExtractResponse;
  return data.results;
}
