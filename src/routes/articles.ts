import { Router } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, outletTopicArticles, searchedJournalistArticles } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateArticleBodySchema, BulkCreateArticlesBodySchema } from "../schemas.js";

const router = Router();

// POST /v1/articles — create/upsert article by URL
router.post("/v1/articles", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateArticleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [article] = await db
      .insert(articles)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: articles.articleUrl,
        set: {
          ...parsed.data,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(article);
  } catch (err) {
    console.error("[Articles Service] Error creating article:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/articles — list with filters
router.get("/v1/articles", async (req, res) => {
  try {
    const { outletId, topicId, journalistId, limit, offset } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = Number(offset) || 0;

    // If filtering by outlet+topic, join through outlet_topic_articles
    if (outletId || topicId) {
      const conditions = [];
      if (outletId) conditions.push(eq(outletTopicArticles.outletId, outletId as string));
      if (topicId) conditions.push(eq(outletTopicArticles.topicId, topicId as string));

      const rows = await db
        .select({ article: articles })
        .from(articles)
        .innerJoin(outletTopicArticles, eq(articles.id, outletTopicArticles.articleId))
        .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
        .limit(take)
        .offset(skip)
        .orderBy(articles.createdAt);

      res.json({ articles: rows.map((r) => r.article) });
      return;
    }

    // If filtering by journalist, join through searched_journalist_articles
    if (journalistId) {
      const rows = await db
        .select({ article: articles })
        .from(articles)
        .innerJoin(searchedJournalistArticles, eq(articles.id, searchedJournalistArticles.articleId))
        .where(eq(searchedJournalistArticles.journalistId, journalistId as string))
        .limit(take)
        .offset(skip)
        .orderBy(articles.createdAt);

      res.json({ articles: rows.map((r) => r.article) });
      return;
    }

    // No filters — list all
    const rows = await db
      .select()
      .from(articles)
      .limit(take)
      .offset(skip)
      .orderBy(articles.createdAt);

    res.json({ articles: rows });
  } catch (err) {
    console.error("[Articles Service] Error listing articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/articles/authors — computed view
router.get("/v1/articles/authors", async (req, res) => {
  try {
    const take = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.offset) || 0;

    const rows = await db
      .select()
      .from(articles)
      .limit(take)
      .offset(skip)
      .orderBy(articles.createdAt);

    const result = rows.map(computeAuthorView);
    res.json({ articles: result });
  } catch (err) {
    console.error("[Articles Service] Error fetching authors view:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/articles/by-journalist/:journalistId
router.get("/v1/articles/by-journalist/:journalistId", async (req, res) => {
  try {
    const rows = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(searchedJournalistArticles, eq(articles.id, searchedJournalistArticles.articleId))
      .where(eq(searchedJournalistArticles.journalistId, req.params.journalistId))
      .orderBy(articles.createdAt);

    res.json({ articles: rows.map((r) => computeAuthorView(r.article)) });
  } catch (err) {
    console.error("[Articles Service] Error fetching journalist articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/articles/by-journalist-outlet/:journalistId/:outletId
router.get("/v1/articles/by-journalist-outlet/:journalistId/:outletId", async (req, res) => {
  try {
    const { journalistId, outletId } = req.params;

    // Articles that are both linked to this journalist AND to this outlet
    const journalistArticleIds = db
      .select({ id: searchedJournalistArticles.articleId })
      .from(searchedJournalistArticles)
      .where(eq(searchedJournalistArticles.journalistId, journalistId));

    const rows = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(outletTopicArticles, eq(articles.id, outletTopicArticles.articleId))
      .where(
        sql`${outletTopicArticles.outletId} = ${outletId} AND ${articles.id} IN (${journalistArticleIds})`
      )
      .orderBy(articles.createdAt);

    // Deduplicate (article may appear multiple times from different topics)
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.article.id)) return false;
      seen.add(r.article.id);
      return true;
    });

    res.json({ articles: unique.map((r) => computeAuthorView(r.article)) });
  } catch (err) {
    console.error("[Articles Service] Error fetching journalist-outlet articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/articles/:id — single article
router.get("/v1/articles/:id", async (req, res) => {
  try {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, req.params.id))
      .limit(1);

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json(article);
  } catch (err) {
    console.error("[Articles Service] Error fetching article:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/articles/bulk — bulk upsert
router.post("/v1/articles/bulk", requireApiKey, async (req, res) => {
  try {
    const parsed = BulkCreateArticlesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.articles.length === 0) {
      res.json({ articles: [] });
      return;
    }

    const result = await db
      .insert(articles)
      .values(parsed.data.articles)
      .onConflictDoUpdate({
        target: articles.articleUrl,
        set: {
          snippet: sql`EXCLUDED.snippet`,
          ogDescription: sql`EXCLUDED.og_description`,
          twitterCreator: sql`EXCLUDED.twitter_creator`,
          newsKeywords: sql`EXCLUDED.news_keywords`,
          articlePublished: sql`EXCLUDED.article_published`,
          articleChannel: sql`EXCLUDED.article_channel`,
          twitterTitle: sql`EXCLUDED.twitter_title`,
          articleSection: sql`EXCLUDED.article_section`,
          author: sql`EXCLUDED.author`,
          ogTitle: sql`EXCLUDED.og_title`,
          articleAuthor: sql`EXCLUDED.article_author`,
          twitterDescription: sql`EXCLUDED.twitter_description`,
          articleModified: sql`EXCLUDED.article_modified`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ articles: result });
  } catch (err) {
    console.error("[Articles Service] Error bulk creating articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/articles/search — full-text search
router.post("/v1/articles/search", async (req, res) => {
  try {
    const parsed = req.body as { query?: string; limit?: number; offset?: number };
    if (!parsed.query || typeof parsed.query !== "string") {
      res.status(400).json({ error: "Invalid request", details: { formErrors: ["query is required"], fieldErrors: {} } });
      return;
    }

    const take = Math.min(Number(parsed.limit) || 20, 100);
    const skip = Number(parsed.offset) || 0;

    const rows = await db
      .select()
      .from(articles)
      .where(
        sql`to_tsvector('english',
          COALESCE(${articles.ogTitle}, '') || ' ' ||
          COALESCE(${articles.twitterTitle}, '') || ' ' ||
          COALESCE(${articles.snippet}, '') || ' ' ||
          COALESCE(${articles.ogDescription}, '') || ' ' ||
          COALESCE(${articles.newsKeywords}, '')
        ) @@ plainto_tsquery('english', ${parsed.query})`
      )
      .limit(take)
      .offset(skip)
      .orderBy(articles.createdAt);

    res.json({ articles: rows });
  } catch (err) {
    console.error("[Articles Service] Error searching articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Helper: compute v_articles_authors fields ---

function computeAuthorView(article: typeof articles.$inferSelect) {
  const computedTitle = article.ogTitle || article.twitterTitle || null;

  // Find the longest text field
  const textFields = [article.snippet, article.ogDescription, article.twitterDescription].filter(Boolean) as string[];
  const computedLargestContent = textFields.length > 0
    ? textFields.reduce((a, b) => (a.length >= b.length ? a : b))
    : null;

  // Collect non-null authors
  const computedAuthors = [article.author, article.articleAuthor, article.twitterCreator].filter(Boolean) as string[];

  // Try to parse published date
  let computedPublishedAt: string | null = null;
  if (article.articlePublished) {
    try {
      const d = new Date(article.articlePublished);
      if (!isNaN(d.getTime())) {
        computedPublishedAt = d.toISOString();
      }
    } catch {
      // Leave as null
    }
  }

  return {
    articleId: article.id,
    articleUrl: article.articleUrl,
    computedTitle,
    computedLargestContent,
    computedAuthors,
    computedPublishedAt,
    lastActivityAt: article.updatedAt.toISOString(),
    articleCreatedAt: article.createdAt.toISOString(),
  };
}

export default router;
