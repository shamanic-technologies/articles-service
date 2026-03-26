interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  date: string;
  domain: string;
}

interface NewsSearchResponse {
  results: NewsResult[];
}

export async function searchNews(
  query: string,
  num: number,
  headers: { orgId: string; userId: string; runId: string; featureSlug?: string; campaignId?: string },
): Promise<NewsResult[]> {
  const baseUrl = process.env.GOOGLE_SERVICE_URL;
  const apiKey = process.env.GOOGLE_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("GOOGLE_SERVICE_URL and GOOGLE_SERVICE_API_KEY must be set");
  }

  const res = await fetch(`${baseUrl}/search/news`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "x-org-id": headers.orgId,
      "x-user-id": headers.userId,
      "x-run-id": headers.runId,
      ...(headers.featureSlug ? { "x-feature-slug": headers.featureSlug } : {}),
      ...(headers.campaignId ? { "x-campaign-id": headers.campaignId } : {}),
    },
    body: JSON.stringify({ query, num }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google news search failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as NewsSearchResponse;
  return data.results;
}
