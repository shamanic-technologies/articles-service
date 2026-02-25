import { Router } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, outletTopicArticles } from "../db/schema.js";

const router = Router();

// GET /internal/articles/by-urls — batch lookup by URLs
router.get("/internal/articles/by-urls", async (req, res) => {
  try {
    const urlsParam = req.query.urls as string;
    if (!urlsParam) {
      res.status(400).json({ error: "urls query parameter is required" });
      return;
    }

    const urls = urlsParam.split(",").map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      res.json({ articles: [] });
      return;
    }

    const rows = await db
      .select()
      .from(articles)
      .where(inArray(articles.articleUrl, urls));

    res.json({ articles: rows });
  } catch (err) {
    console.error("[Articles Service] Error fetching articles by URLs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /internal/articles/by-outlet-topic/:outletId/:topicId
router.get("/internal/articles/by-outlet-topic/:outletId/:topicId", async (req, res) => {
  try {
    const { outletId, topicId } = req.params;

    const rows = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(outletTopicArticles, eq(articles.id, outletTopicArticles.articleId))
      .where(
        and(
          eq(outletTopicArticles.outletId, outletId),
          eq(outletTopicArticles.topicId, topicId),
        )
      )
      .orderBy(articles.createdAt);

    res.json({ articles: rows.map((r) => r.article) });
  } catch (err) {
    console.error("[Articles Service] Error fetching articles by outlet-topic:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
