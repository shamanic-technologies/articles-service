import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, articleDiscoveries } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { searchNews } from "../services/google.js";
import { extractArticles, type ExtractResultSuccess } from "../services/scraping.js";
import {
  DiscoverOutletArticlesBodySchema,
  DiscoverJournalistPublicationsBodySchema,
} from "../schemas.js";

const router = Router();

// POST /v1/discover/outlet-articles
// Finds recent articles from an outlet via Google News, extracts authors via scraping service
router.post("/v1/discover/outlet-articles", requireApiKey, async (req, res) => {
  try {
    const parsed = DiscoverOutletArticlesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { outletDomain, brandId, campaignId, maxArticles } = parsed.data;
    const identityHeaders = {
      orgId: req.headers["x-org-id"] as string,
      userId: req.headers["x-user-id"] as string,
      runId: req.headers["x-run-id"] as string,
      featureSlug: req.headers["x-feature-slug"] as string | undefined,
      campaignId: (req.headers["x-campaign-id"] as string | undefined) ?? campaignId,
    };

    // Step 1: Search Google News for articles from this outlet
    const newsResults = await searchNews(
      `site:${outletDomain}`,
      maxArticles,
      identityHeaders,
    );

    if (newsResults.length === 0) {
      res.json({ articles: [] });
      return;
    }

    const urls = newsResults.map((r) => r.link);

    // Step 2: Extract authors + publishedAt via scraping service (batches of 10)
    const allExtractResults: ExtractResultSuccess[] = [];
    for (let i = 0; i < urls.length; i += 10) {
      const batch = urls.slice(i, i + 10);
      const results = await extractArticles(batch, identityHeaders);
      for (const r of results) {
        if (r.success) allExtractResults.push(r);
      }
    }

    if (allExtractResults.length === 0) {
      res.json({ articles: [] });
      return;
    }

    // Step 3: Bulk upsert articles
    const newsByUrl = new Map(newsResults.map((r) => [r.link, r]));
    const articleValues = allExtractResults.map((ext) => {
      const news = newsByUrl.get(ext.url);
      return {
        articleUrl: ext.url,
        ogTitle: news?.title ?? null,
        snippet: news?.snippet ?? null,
        ogDescription: null,
        articlePublished: ext.publishedAt ?? null,
        author: ext.authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ") || null,
      };
    });

    const upserted = await db
      .insert(articles)
      .values(articleValues)
      .onConflictDoUpdate({
        target: articles.articleUrl,
        set: {
          ogTitle: sql`EXCLUDED.og_title`,
          snippet: sql`EXCLUDED.snippet`,
          ogDescription: sql`EXCLUDED.og_description`,
          articlePublished: sql`EXCLUDED.article_published`,
          author: sql`EXCLUDED.author`,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Step 4: Create discovery records scoped to this campaign
    const discoveryValues = upserted.map((article) => ({
      articleId: article.id,
      orgId: identityHeaders.orgId,
      brandId,
      featureSlug: identityHeaders.featureSlug ?? "unknown",
      campaignId,
      outletId: null as string | null,
      journalistId: null as string | null,
      topicId: null as string | null,
    }));

    if (discoveryValues.length > 0) {
      await db
        .insert(articleDiscoveries)
        .values(discoveryValues)
        .onConflictDoNothing();
    }

    // Step 5: Build response with extracted author details
    const extractByUrl = new Map(allExtractResults.map((r) => [r.url, r]));
    const response = upserted.map((article) => {
      const ext = extractByUrl.get(article.articleUrl);
      return {
        articleId: article.id,
        articleUrl: article.articleUrl,
        title: article.ogTitle ?? null,
        snippet: article.snippet ?? null,
        authors: ext?.authors ?? [],
        publishedAt: ext?.publishedAt ?? null,
      };
    });

    res.json({ articles: response });
  } catch (err) {
    console.error("[Articles Service] Error discovering outlet articles:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to discover outlet articles",
    });
  }
});

// POST /v1/discover/journalist-publications
// Finds recent publications by a specific journalist across the web
router.post("/v1/discover/journalist-publications", requireApiKey, async (req, res) => {
  try {
    const parsed = DiscoverJournalistPublicationsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { journalistFirstName, journalistLastName, journalistId, brandId, campaignId, maxResults } = parsed.data;
    const identityHeaders = {
      orgId: req.headers["x-org-id"] as string,
      userId: req.headers["x-user-id"] as string,
      runId: req.headers["x-run-id"] as string,
      featureSlug: req.headers["x-feature-slug"] as string | undefined,
      campaignId: (req.headers["x-campaign-id"] as string | undefined) ?? campaignId,
    };

    // Step 1: Search Google News for this journalist's articles
    const query = `"${journalistFirstName} ${journalistLastName}"`;
    const newsResults = await searchNews(query, maxResults, identityHeaders);

    if (newsResults.length === 0) {
      res.json({ articles: [] });
      return;
    }

    const urls = newsResults.map((r) => r.link);

    // Step 2: Extract authors + publishedAt via scraping service
    const allExtractResults: ExtractResultSuccess[] = [];
    for (let i = 0; i < urls.length; i += 10) {
      const batch = urls.slice(i, i + 10);
      const results = await extractArticles(batch, identityHeaders);
      for (const r of results) {
        if (r.success) allExtractResults.push(r);
      }
    }

    if (allExtractResults.length === 0) {
      res.json({ articles: [] });
      return;
    }

    // Step 3: Bulk upsert articles
    const newsByUrl = new Map(newsResults.map((r) => [r.link, r]));
    const articleValues = allExtractResults.map((ext) => {
      const news = newsByUrl.get(ext.url);
      return {
        articleUrl: ext.url,
        ogTitle: news?.title ?? null,
        snippet: news?.snippet ?? null,
        ogDescription: null,
        articlePublished: ext.publishedAt ?? null,
        author: ext.authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ") || null,
      };
    });

    const upserted = await db
      .insert(articles)
      .values(articleValues)
      .onConflictDoUpdate({
        target: articles.articleUrl,
        set: {
          ogTitle: sql`EXCLUDED.og_title`,
          snippet: sql`EXCLUDED.snippet`,
          ogDescription: sql`EXCLUDED.og_description`,
          articlePublished: sql`EXCLUDED.article_published`,
          author: sql`EXCLUDED.author`,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Step 4: Create discovery records scoped to this campaign + journalist
    const discoveryValues = upserted.map((a) => ({
      articleId: a.id,
      orgId: identityHeaders.orgId,
      brandId,
      featureSlug: identityHeaders.featureSlug ?? "unknown",
      campaignId,
      outletId: null as string | null,
      journalistId,
      topicId: null as string | null,
    }));

    if (discoveryValues.length > 0) {
      await db
        .insert(articleDiscoveries)
        .values(discoveryValues)
        .onConflictDoNothing();
    }

    // Step 5: Build response
    const extractByUrl = new Map(allExtractResults.map((r) => [r.url, r]));
    const response = upserted.map((article) => {
      const ext = extractByUrl.get(article.articleUrl);
      return {
        articleId: article.id,
        articleUrl: article.articleUrl,
        title: article.ogTitle ?? null,
        snippet: article.snippet ?? null,
        authors: ext?.authors ?? [],
        publishedAt: ext?.publishedAt ?? null,
      };
    });

    res.json({ articles: response });
  } catch (err) {
    console.error("[Articles Service] Error discovering journalist publications:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to discover journalist publications",
    });
  }
});

export default router;
