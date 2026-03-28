function getWorkflowConfig() {
  return {
    url: process.env.WORKFLOW_SERVICE_URL,
    apiKey: process.env.WORKFLOW_SERVICE_API_KEY,
  };
}

function getFeaturesConfig() {
  return {
    url: process.env.FEATURES_SERVICE_URL,
    apiKey: process.env.FEATURES_SERVICE_API_KEY,
  };
}

export interface DynastyEntry {
  dynastySlug: string;
  slugs: string[];
}

function buildReqHeaders(
  apiKey: string,
  headers?: { orgId?: string; userId?: string; runId?: string },
): Record<string, string> {
  const h: Record<string, string> = { "X-API-Key": apiKey };
  if (headers?.orgId) h["x-org-id"] = headers.orgId;
  if (headers?.userId) h["x-user-id"] = headers.userId;
  if (headers?.runId) h["x-run-id"] = headers.runId;
  return h;
}

export async function resolveWorkflowDynastySlugs(
  dynastySlug: string,
  headers?: { orgId?: string; userId?: string; runId?: string },
): Promise<string[]> {
  const { url: baseUrl, apiKey } = getWorkflowConfig();
  if (!baseUrl || !apiKey) {
    console.warn("[Articles Service] WORKFLOW_SERVICE_URL or WORKFLOW_SERVICE_API_KEY not set, cannot resolve dynasty slug");
    return [];
  }

  const url = `${baseUrl}/workflows/dynasty/slugs?dynastySlug=${encodeURIComponent(dynastySlug)}`;
  const res = await fetch(url, { headers: buildReqHeaders(apiKey, headers) });
  if (!res.ok) {
    console.error(`[Articles Service] Failed to resolve workflow dynasty slug "${dynastySlug}": ${res.status}`);
    return [];
  }

  const body = (await res.json()) as { slugs: string[] };
  return body.slugs ?? [];
}

export async function resolveFeatureDynastySlugs(
  dynastySlug: string,
  headers?: { orgId?: string; userId?: string; runId?: string },
): Promise<string[]> {
  const { url: baseUrl, apiKey } = getFeaturesConfig();
  if (!baseUrl || !apiKey) {
    console.warn("[Articles Service] FEATURES_SERVICE_URL or FEATURES_SERVICE_API_KEY not set, cannot resolve dynasty slug");
    return [];
  }

  const url = `${baseUrl}/features/dynasty/slugs?dynastySlug=${encodeURIComponent(dynastySlug)}`;
  const res = await fetch(url, { headers: buildReqHeaders(apiKey, headers) });
  if (!res.ok) {
    console.error(`[Articles Service] Failed to resolve feature dynasty slug "${dynastySlug}": ${res.status}`);
    return [];
  }

  const body = (await res.json()) as { slugs: string[] };
  return body.slugs ?? [];
}

export async function fetchAllWorkflowDynasties(
  headers?: { orgId?: string; userId?: string; runId?: string },
): Promise<DynastyEntry[]> {
  const { url: baseUrl, apiKey } = getWorkflowConfig();
  if (!baseUrl || !apiKey) {
    console.warn("[Articles Service] WORKFLOW_SERVICE_URL or WORKFLOW_SERVICE_API_KEY not set, cannot fetch dynasties");
    return [];
  }

  const url = `${baseUrl}/workflows/dynasties`;
  const res = await fetch(url, { headers: buildReqHeaders(apiKey, headers) });
  if (!res.ok) {
    console.error(`[Articles Service] Failed to fetch workflow dynasties: ${res.status}`);
    return [];
  }

  const body = (await res.json()) as { dynasties: DynastyEntry[] };
  return body.dynasties ?? [];
}

export async function fetchAllFeatureDynasties(
  headers?: { orgId?: string; userId?: string; runId?: string },
): Promise<DynastyEntry[]> {
  const { url: baseUrl, apiKey } = getFeaturesConfig();
  if (!baseUrl || !apiKey) {
    console.warn("[Articles Service] FEATURES_SERVICE_URL or FEATURES_SERVICE_API_KEY not set, cannot fetch dynasties");
    return [];
  }

  const url = `${baseUrl}/features/dynasties`;
  const res = await fetch(url, { headers: buildReqHeaders(apiKey, headers) });
  if (!res.ok) {
    console.error(`[Articles Service] Failed to fetch feature dynasties: ${res.status}`);
    return [];
  }

  const body = (await res.json()) as { dynasties: DynastyEntry[] };
  return body.dynasties ?? [];
}

export function buildSlugToDynastyMap(dynasties: DynastyEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of dynasties) {
    for (const slug of d.slugs) map.set(slug, d.dynastySlug);
  }
  return map;
}
