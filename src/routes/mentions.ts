import { Router } from "express";
import { sql, eq, and, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, articleMentions } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateMentionBodySchema, MentionsQuerySchema } from "../schemas.js";
import {
  extractArticles,
  serializeAuthors,
  toPublishedTimestamp,
} from "../services/scraping.js";
import type { IdentityHeaders } from "../services/google.js";

const router = Router();

function parseBrandIds(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function getIdentityHeaders(req: import("express").Request): IdentityHeaders {
  return {
    orgId: req.headers["x-org-id"] as string,
    userId: req.headers["x-user-id"] as string,
    runId: req.headers["x-run-id"] as string,
    workflowSlug: req.headers["x-workflow-slug"] as string | undefined,
    featureSlug: req.headers["x-feature-slug"] as string | undefined,
    brandId: req.headers["x-brand-id"] as string | undefined,
    campaignId: req.headers["x-campaign-id"] as string | undefined,
    audienceId: req.headers["x-audience-id"] as string | undefined,
  };
}

/**
 * Resolve the article for a mention to its DB id.
 * - articleId: must already exist (404 otherwise).
 * - articleUrl: scrape + extract (best-effort) and upsert by URL. Scrape failure
 *   does NOT block recording the win — the article row is created bare and can be
 *   enriched later by the discover pipeline.
 */
async function resolveArticleId(
  body: { articleId?: string; articleUrl?: string },
  identityHeaders: IdentityHeaders,
): Promise<{ articleId: string } | { notFound: true }> {
  if (body.articleId) {
    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, body.articleId));
    if (!existing) return { notFound: true };
    return { articleId: existing.id };
  }

  const url = body.articleUrl!;
  let ext;
  try {
    const results = await extractArticles([url], identityHeaders);
    ext = results.find((r) => r.success);
  } catch (err) {
    // Enrichment is best-effort; the win is the critical path. Log loudly, continue bare.
    console.error(`[Articles Service] Mention enrichment scrape failed for ${url}:`, err);
  }

  const enrichedSet = ext
    ? {
        articlePublished: ext.publishedAt ?? null,
        publishedAt: toPublishedTimestamp(ext.publishedAt),
        author: ext.authors.length > 0 ? serializeAuthors(ext.authors) : null,
        markdownLength: ext.markdownLength,
        wordCount: ext.wordCount,
        extractedAt: new Date(),
        updatedAt: new Date(),
      }
    : { updatedAt: new Date() };

  const [article] = await db
    .insert(articles)
    .values({
      articleUrl: url,
      articlePublished: ext?.publishedAt ?? null,
      publishedAt: toPublishedTimestamp(ext?.publishedAt),
      author: ext && ext.authors.length > 0 ? serializeAuthors(ext.authors) : null,
      markdownLength: ext?.markdownLength ?? null,
      wordCount: ext?.wordCount ?? null,
      extractedAt: ext ? new Date() : null,
    })
    .onConflictDoUpdate({ target: articles.articleUrl, set: enrichedSet })
    .returning();

  return { articleId: article.id };
}

// POST /v1/mentions — record an earned-media placement (the "win")
router.post("/v1/mentions", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateMentionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;

    // Cross-field validation (fail loud, no silent coercion).
    if (!d.articleId && !d.articleUrl) {
      res.status(400).json({ error: "Either articleId or articleUrl is required" });
      return;
    }
    if (d.articleId && d.articleUrl) {
      res.status(400).json({ error: "Provide only one of articleId or articleUrl" });
      return;
    }
    if (d.hasLink === false && d.linkDofollow !== undefined) {
      res.status(400).json({ error: "linkDofollow must be omitted when hasLink is false" });
      return;
    }
    if (d.isPaid === true && d.costUsdCents === undefined) {
      res.status(400).json({ error: "costUsdCents is required when isPaid is true" });
      return;
    }
    if (d.isPaid === false && d.costUsdCents !== undefined) {
      res.status(400).json({ error: "costUsdCents must be omitted when isPaid is false" });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const userId = req.headers["x-user-id"] as string;
    const rawBrandId = req.headers["x-brand-id"] as string | undefined;
    const campaignId = req.headers["x-campaign-id"] as string | undefined;

    if (!rawBrandId || !campaignId) {
      res.status(400).json({ error: "x-brand-id and x-campaign-id headers are required" });
      return;
    }

    const brandIds = parseBrandIds(rawBrandId);
    const identityHeaders = getIdentityHeaders(req);

    const resolved = await resolveArticleId(d, identityHeaders);
    if ("notFound" in resolved) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const [mention] = await db
      .insert(articleMentions)
      .values({
        articleId: resolved.articleId,
        orgId,
        brandIds,
        outletId: d.outletId,
        journalistId: d.journalistId,
        campaignId,
        pitchId: d.pitchId ?? null,
        hasMention: d.hasMention,
        hasQuote: d.hasQuote,
        hasLink: d.hasLink,
        linkDofollow: d.linkDofollow ?? null,
        placementType: d.placementType,
        isPaid: d.isPaid,
        costUsdCents: d.costUsdCents ?? null,
        source: "manual",
        createdBy: userId,
      })
      .returning();

    res.json(mention);
  } catch (err) {
    console.error("[Articles Service] Error recording mention:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/mentions — list mentions for the org, joined with article data
router.get("/v1/mentions", async (req, res) => {
  try {
    const parsed = MentionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
      return;
    }

    const orgId = req.headers["x-org-id"] as string;
    const take = Math.min(parsed.data.limit ?? 20, 100);
    const skip = parsed.data.offset ?? 0;
    const { brandId, campaignId, outletId, journalistId } = parsed.data;

    const conditions: SQL[] = [eq(articleMentions.orgId, orgId)];
    if (brandId) conditions.push(sql`${brandId} = ANY(${articleMentions.brandIds})`);
    if (campaignId) conditions.push(eq(articleMentions.campaignId, campaignId));
    if (outletId) conditions.push(eq(articleMentions.outletId, outletId));
    if (journalistId) conditions.push(eq(articleMentions.journalistId, journalistId));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select({ mention: articleMentions, article: articles })
      .from(articleMentions)
      .innerJoin(articles, eq(articleMentions.articleId, articles.id))
      .where(whereClause)
      .limit(take)
      .offset(skip)
      .orderBy(articleMentions.createdAt);

    res.json({ mentions: rows });
  } catch (err) {
    console.error("[Articles Service] Error listing mentions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
