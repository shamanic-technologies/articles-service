import { Router } from "express";
import { eq, and, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, articleDiscoveries } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateDiscoveryBodySchema, BulkCreateDiscoveriesBodySchema, DiscoveriesQuerySchema } from "../schemas.js";
import { resolveWorkflowDynastySlugs, resolveFeatureDynastySlugs } from "../services/dynasty.js";

const router = Router();

function parseBrandIds(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// POST /v1/discoveries — create a single discovery record
router.post("/v1/discoveries", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateDiscoveryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const rawBrandId = req.headers["x-brand-id"] as string | undefined;
    const campaignId = req.headers["x-campaign-id"] as string | undefined;
    const featureSlug = req.headers["x-feature-slug"] as string | undefined;
    const workflowSlug = req.headers["x-workflow-slug"] as string | undefined;

    if (!rawBrandId || !campaignId) {
      res.status(400).json({ error: "x-brand-id and x-campaign-id headers are required" });
      return;
    }

    const brandIds = parseBrandIds(rawBrandId);

    const [discovery] = await db
      .insert(articleDiscoveries)
      .values({
        articleId: parsed.data.articleId,
        orgId,
        brandIds,
        featureSlug: featureSlug ?? "unknown",
        workflowSlug: workflowSlug ?? null,
        campaignId,
        outletId: parsed.data.outletId ?? null,
        journalistId: parsed.data.journalistId ?? null,
        topicId: parsed.data.topicId ?? null,
      })
      .returning();

    res.json(discovery);
  } catch (err) {
    console.error("[Articles Service] Error creating discovery:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/discoveries/bulk — bulk create discoveries
router.post("/v1/discoveries/bulk", requireApiKey, async (req, res) => {
  try {
    const parsed = BulkCreateDiscoveriesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.discoveries.length === 0) {
      res.json({ discoveries: [] });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const rawBrandId = req.headers["x-brand-id"] as string | undefined;
    const campaignId = req.headers["x-campaign-id"] as string | undefined;
    const featureSlug = req.headers["x-feature-slug"] as string | undefined;
    const workflowSlug = req.headers["x-workflow-slug"] as string | undefined;

    if (!rawBrandId || !campaignId) {
      res.status(400).json({ error: "x-brand-id and x-campaign-id headers are required" });
      return;
    }

    const brandIds = parseBrandIds(rawBrandId);

    const values = parsed.data.discoveries.map((d) => ({
      articleId: d.articleId,
      orgId,
      brandIds,
      featureSlug: featureSlug ?? "unknown",
      workflowSlug: workflowSlug ?? null,
      campaignId,
      outletId: d.outletId ?? null,
      journalistId: d.journalistId ?? null,
      topicId: d.topicId ?? null,
    }));

    const result = await db
      .insert(articleDiscoveries)
      .values(values)
      .onConflictDoNothing()
      .returning();

    res.json({ discoveries: result });
  } catch (err) {
    console.error("[Articles Service] Error bulk creating discoveries:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/discoveries — list with filters, joined with articles
router.get("/v1/discoveries", async (req, res) => {
  try {
    const parsed = DiscoveriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const take = Math.min(parsed.data.limit ?? 20, 100);
    const skip = parsed.data.offset ?? 0;

    const {
      brandId,
      campaignId,
      outletId,
      journalistId,
      topicId,
      featureSlug,
      featureSlugs: featureSlugsParam,
      featureDynastySlug,
      workflowSlug,
      workflowSlugs: workflowSlugsParam,
      workflowDynastySlug,
    } = parsed.data;

    const identityHeaders = {
      orgId: req.headers["x-org-id"] as string | undefined,
      userId: req.headers["x-user-id"] as string | undefined,
      runId: req.headers["x-run-id"] as string | undefined,
    };

    const conditions: SQL[] = [eq(articleDiscoveries.orgId, orgId)];

    if (brandId) conditions.push(sql`${brandId} = ANY(${articleDiscoveries.brandIds})`);
    if (campaignId) conditions.push(eq(articleDiscoveries.campaignId, campaignId));
    if (outletId) conditions.push(eq(articleDiscoveries.outletId, outletId));
    if (journalistId) conditions.push(eq(articleDiscoveries.journalistId, journalistId));
    if (topicId) conditions.push(eq(articleDiscoveries.topicId, topicId));

    // Feature filtering: dynastySlug > featureSlugs > featureSlug
    let resolvedFeatureSlugs: string[] | undefined;
    if (featureDynastySlug) {
      resolvedFeatureSlugs = await resolveFeatureDynastySlugs(featureDynastySlug, identityHeaders);
      if (resolvedFeatureSlugs.length === 0) {
        res.json({ discoveries: [] });
        return;
      }
    } else if (featureSlugsParam && featureSlugsParam.length > 0) {
      resolvedFeatureSlugs = featureSlugsParam;
    }

    if (resolvedFeatureSlugs && resolvedFeatureSlugs.length > 0) {
      conditions.push(inArray(articleDiscoveries.featureSlug, resolvedFeatureSlugs));
    } else if (featureSlug) {
      conditions.push(eq(articleDiscoveries.featureSlug, featureSlug));
    }

    // Workflow filtering: dynastySlug > workflowSlugs > workflowSlug
    let resolvedWorkflowSlugs: string[] | undefined;
    if (workflowDynastySlug) {
      resolvedWorkflowSlugs = await resolveWorkflowDynastySlugs(workflowDynastySlug, identityHeaders);
      if (resolvedWorkflowSlugs.length === 0) {
        res.json({ discoveries: [] });
        return;
      }
    } else if (workflowSlugsParam && workflowSlugsParam.length > 0) {
      resolvedWorkflowSlugs = workflowSlugsParam;
    }

    if (resolvedWorkflowSlugs && resolvedWorkflowSlugs.length > 0) {
      conditions.push(inArray(articleDiscoveries.workflowSlug, resolvedWorkflowSlugs));
    } else if (workflowSlug) {
      conditions.push(eq(articleDiscoveries.workflowSlug, workflowSlug));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select({
        discovery: articleDiscoveries,
        article: articles,
      })
      .from(articleDiscoveries)
      .innerJoin(articles, eq(articleDiscoveries.articleId, articles.id))
      .where(whereClause)
      .limit(take)
      .offset(skip)
      .orderBy(articleDiscoveries.createdAt);

    res.json({ discoveries: rows });
  } catch (err) {
    console.error("[Articles Service] Error listing discoveries:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
