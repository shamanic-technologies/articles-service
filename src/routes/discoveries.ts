import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, articleDiscoveries } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateDiscoveryBodySchema, BulkCreateDiscoveriesBodySchema } from "../schemas.js";

const router = Router();

// POST /v1/discoveries — create a single discovery record
router.post("/v1/discoveries", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateDiscoveryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const brandId = req.headers["x-brand-id"] as string | undefined;
    const campaignId = req.headers["x-campaign-id"] as string | undefined;
    const featureSlug = req.headers["x-feature-slug"] as string | undefined;

    if (!brandId || !campaignId) {
      res.status(400).json({ error: "x-brand-id and x-campaign-id headers are required" });
      return;
    }

    const [discovery] = await db
      .insert(articleDiscoveries)
      .values({
        articleId: parsed.data.articleId,
        orgId,
        brandId,
        featureSlug: featureSlug ?? "unknown",
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
    const brandId = req.headers["x-brand-id"] as string | undefined;
    const campaignId = req.headers["x-campaign-id"] as string | undefined;
    const featureSlug = req.headers["x-feature-slug"] as string | undefined;

    if (!brandId || !campaignId) {
      res.status(400).json({ error: "x-brand-id and x-campaign-id headers are required" });
      return;
    }

    const values = parsed.data.discoveries.map((d) => ({
      articleId: d.articleId,
      orgId,
      brandId,
      featureSlug: featureSlug ?? "unknown",
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
    const orgId = req.headers["x-org-id"] as string;
    const take = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.offset) || 0;

    const conditions = [eq(articleDiscoveries.orgId, orgId)];

    if (req.query.brandId) conditions.push(eq(articleDiscoveries.brandId, req.query.brandId as string));
    if (req.query.campaignId) conditions.push(eq(articleDiscoveries.campaignId, req.query.campaignId as string));
    if (req.query.outletId) conditions.push(eq(articleDiscoveries.outletId, req.query.outletId as string));
    if (req.query.journalistId) conditions.push(eq(articleDiscoveries.journalistId, req.query.journalistId as string));
    if (req.query.topicId) conditions.push(eq(articleDiscoveries.topicId, req.query.topicId as string));

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
