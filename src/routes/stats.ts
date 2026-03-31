import { Router } from "express";
import { eq, and, inArray, sql, count, countDistinct, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { articleDiscoveries } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { requireIdentity } from "../middleware/identity.js";
import { StatsQuerySchema } from "../schemas.js";
import {
  resolveWorkflowDynastySlugs,
  resolveFeatureDynastySlugs,
  fetchAllWorkflowDynasties,
  fetchAllFeatureDynasties,
  buildSlugToDynastyMap,
} from "../services/dynasty.js";

const router = Router();

interface StatsResult {
  totalDiscoveries: number;
  uniqueArticles: number;
  uniqueOutlets: number;
  uniqueJournalists: number;
}

const ZERO_STATS: StatsResult = {
  totalDiscoveries: 0,
  uniqueArticles: 0,
  uniqueOutlets: 0,
  uniqueJournalists: 0,
};

type BuildConditionsData = {
  orgId?: string;
  brandId?: string;
  campaignId?: string;
  workflowSlug?: string;
  featureSlug?: string;
  workflowSlugs?: string[];
  featureSlugs?: string[];
};

function buildConditions(data: BuildConditionsData) {
  const conditions: SQL[] = [];

  if (data.orgId) conditions.push(eq(articleDiscoveries.orgId, data.orgId));
  if (data.brandId) conditions.push(sql`${data.brandId} = ANY(${articleDiscoveries.brandIds})`);
  if (data.campaignId) conditions.push(eq(articleDiscoveries.campaignId, data.campaignId));

  // Dynasty slugs (resolved list) take priority over exact slugs
  if (data.workflowSlugs && data.workflowSlugs.length > 0) {
    conditions.push(inArray(articleDiscoveries.workflowSlug, data.workflowSlugs));
  } else if (data.workflowSlug) {
    conditions.push(eq(articleDiscoveries.workflowSlug, data.workflowSlug));
  }

  if (data.featureSlugs && data.featureSlugs.length > 0) {
    conditions.push(inArray(articleDiscoveries.featureSlug, data.featureSlugs));
  } else if (data.featureSlug) {
    conditions.push(eq(articleDiscoveries.featureSlug, data.featureSlug));
  }

  return conditions;
}

async function queryStats(conditions: SQL[]): Promise<StatsResult> {
  const whereClause = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

  const [row] = await db
    .select({
      totalDiscoveries: count(),
      uniqueArticles: countDistinct(articleDiscoveries.articleId),
      uniqueOutlets: countDistinct(articleDiscoveries.outletId),
      uniqueJournalists: countDistinct(articleDiscoveries.journalistId),
    })
    .from(articleDiscoveries)
    .where(whereClause);

  return {
    totalDiscoveries: Number(row.totalDiscoveries),
    uniqueArticles: Number(row.uniqueArticles),
    uniqueOutlets: Number(row.uniqueOutlets),
    uniqueJournalists: Number(row.uniqueJournalists),
  };
}

async function queryGroupedStats(
  conditions: SQL[],
  groupByColumn: "workflowSlug" | "featureSlug" | "campaignId",
): Promise<{ key: string; stats: StatsResult }[]> {
  const col = articleDiscoveries[groupByColumn];
  const whereClause = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
    .select({
      key: col,
      totalDiscoveries: count(),
      uniqueArticles: countDistinct(articleDiscoveries.articleId),
      uniqueOutlets: countDistinct(articleDiscoveries.outletId),
      uniqueJournalists: countDistinct(articleDiscoveries.journalistId),
    })
    .from(articleDiscoveries)
    .where(whereClause)
    .groupBy(col);

  return rows.map((r) => ({
    key: (r.key as string) ?? "unknown",
    stats: {
      totalDiscoveries: Number(r.totalDiscoveries),
      uniqueArticles: Number(r.uniqueArticles),
      uniqueOutlets: Number(r.uniqueOutlets),
      uniqueJournalists: Number(r.uniqueJournalists),
    },
  }));
}

async function queryGroupedStatsByBrand(
  conditions: SQL[],
): Promise<{ key: string; stats: StatsResult }[]> {
  const whereClause = conditions.length === 0 ? sql`TRUE` : conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db.execute<{
    brand_id: string;
    total_discoveries: string;
    unique_articles: string;
    unique_outlets: string;
    unique_journalists: string;
  }>(sql`
    SELECT
      unnest(brand_ids) AS brand_id,
      count(*) AS total_discoveries,
      count(DISTINCT article_id) AS unique_articles,
      count(DISTINCT outlet_id) AS unique_outlets,
      count(DISTINCT journalist_id) AS unique_journalists
    FROM article_discoveries
    WHERE ${whereClause}
    GROUP BY brand_id
  `);

  return rows.map((r) => ({
    key: r.brand_id ?? "unknown",
    stats: {
      totalDiscoveries: Number(r.total_discoveries),
      uniqueArticles: Number(r.unique_articles),
      uniqueOutlets: Number(r.unique_outlets),
      uniqueJournalists: Number(r.unique_journalists),
    },
  }));
}

async function handleStatsRequest(
  query: Record<string, unknown>,
  identityHeaders?: { orgId?: string; userId?: string; runId?: string },
) {
  const parsed = StatsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { status: 400, body: { error: "Invalid query parameters", details: parsed.error.flatten() } };
  }

  const {
    orgId,
    brandId,
    campaignId,
    workflowSlug,
    featureSlug,
    workflowDynastySlug,
    featureDynastySlug,
    groupBy,
  } = parsed.data;

  // Resolve dynasty slugs to versioned slug lists
  let workflowSlugs: string[] | undefined;
  let featureSlugs: string[] | undefined;

  if (workflowDynastySlug) {
    workflowSlugs = await resolveWorkflowDynastySlugs(workflowDynastySlug, identityHeaders);
    if (workflowSlugs.length === 0) {
      return groupBy
        ? { status: 200, body: { groups: [] } }
        : { status: 200, body: { stats: ZERO_STATS } };
    }
  }

  if (featureDynastySlug) {
    featureSlugs = await resolveFeatureDynastySlugs(featureDynastySlug, identityHeaders);
    if (featureSlugs.length === 0) {
      return groupBy
        ? { status: 200, body: { groups: [] } }
        : { status: 200, body: { stats: ZERO_STATS } };
    }
  }

  const conditions = buildConditions({
    orgId,
    brandId,
    campaignId,
    workflowSlug,
    featureSlug,
    workflowSlugs,
    featureSlugs,
  });

  // No groupBy → flat stats
  if (!groupBy) {
    const stats = await queryStats(conditions);
    return { status: 200, body: { stats } };
  }

  // GroupBy dynasty slug → query by underlying column, then remap keys
  if (groupBy === "workflowDynastySlug" || groupBy === "featureDynastySlug") {
    const underlyingColumn = groupBy === "workflowDynastySlug" ? "workflowSlug" : "featureSlug";
    const rows = await queryGroupedStats(conditions, underlyingColumn);

    const dynasties =
      groupBy === "workflowDynastySlug"
        ? await fetchAllWorkflowDynasties(identityHeaders)
        : await fetchAllFeatureDynasties(identityHeaders);

    const slugToDynasty = buildSlugToDynastyMap(dynasties);

    // Aggregate rows by dynasty slug
    const aggregated = new Map<string, StatsResult>();
    for (const row of rows) {
      const dynastyKey = slugToDynasty.get(row.key) ?? row.key; // fallback to raw slug
      const existing = aggregated.get(dynastyKey);
      if (existing) {
        existing.totalDiscoveries += row.stats.totalDiscoveries;
        existing.uniqueArticles += row.stats.uniqueArticles;
        existing.uniqueOutlets += row.stats.uniqueOutlets;
        existing.uniqueJournalists += row.stats.uniqueJournalists;
      } else {
        aggregated.set(dynastyKey, { ...row.stats });
      }
    }

    const groups = Array.from(aggregated.entries()).map(([key, stats]) => ({ key, stats }));
    return { status: 200, body: { groups } };
  }

  // GroupBy brandId uses unnest since brand_ids is an array
  if (groupBy === "brandId") {
    const groups = await queryGroupedStatsByBrand(conditions);
    return { status: 200, body: { groups } };
  }

  // GroupBy exact slug or other dimension
  const columnMap: Record<string, "workflowSlug" | "featureSlug" | "campaignId"> = {
    workflowSlug: "workflowSlug",
    featureSlug: "featureSlug",
    campaignId: "campaignId",
  };
  const col = columnMap[groupBy];
  if (!col) {
    return { status: 400, body: { error: `Unsupported groupBy value: ${groupBy}` } };
  }

  const groups = await queryGroupedStats(conditions, col);
  return { status: 200, body: { groups } };
}

// GET /v1/stats — private, requires identity headers
router.get("/v1/stats", requireIdentity, async (req, res) => {
  try {
    const identityHeaders = {
      orgId: req.headers["x-org-id"] as string | undefined,
      userId: req.headers["x-user-id"] as string | undefined,
      runId: req.headers["x-run-id"] as string | undefined,
    };

    const result = await handleStatsRequest(req.query as Record<string, unknown>, identityHeaders);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[Articles Service] Error in GET /v1/stats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/stats/public — service auth only (X-API-Key), no identity headers required
router.get("/v1/stats/public", requireApiKey, async (req, res) => {
  try {
    const identityHeaders = {
      orgId: req.headers["x-org-id"] as string | undefined,
      userId: req.headers["x-user-id"] as string | undefined,
      runId: req.headers["x-run-id"] as string | undefined,
    };

    const result = await handleStatsRequest(req.query as Record<string, unknown>, identityHeaders);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[Articles Service] Error in GET /v1/stats/public:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
