import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { outletTopicArticles } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateOutletTopicArticleBodySchema, BulkCreateOutletTopicArticlesBodySchema } from "../schemas.js";

const router = Router();

// POST /v1/outlet-topic-articles — link article to outlet+topic
router.post("/v1/outlet-topic-articles", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateOutletTopicArticleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [link] = await db
      .insert(outletTopicArticles)
      .values(parsed.data)
      .onConflictDoNothing()
      .returning();

    if (!link) {
      // Already exists — fetch it
      const [existing] = await db
        .select()
        .from(outletTopicArticles)
        .where(
          and(
            eq(outletTopicArticles.outletId, parsed.data.outletId),
            eq(outletTopicArticles.topicId, parsed.data.topicId),
            eq(outletTopicArticles.articleId, parsed.data.articleId),
          )
        )
        .limit(1);
      res.json(existing);
      return;
    }

    res.json(link);
  } catch (err) {
    console.error("[Articles Service] Error creating outlet-topic-article link:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/outlet-topic-articles/bulk — bulk link
router.post("/v1/outlet-topic-articles/bulk", requireApiKey, async (req, res) => {
  try {
    const parsed = BulkCreateOutletTopicArticlesBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.links.length === 0) {
      res.json({ links: [] });
      return;
    }

    const result = await db
      .insert(outletTopicArticles)
      .values(parsed.data.links)
      .onConflictDoNothing()
      .returning();

    res.json({ links: result });
  } catch (err) {
    console.error("[Articles Service] Error bulk creating outlet-topic-article links:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/outlet-topic-articles — list by outlet_id and/or topic_id
router.get("/v1/outlet-topic-articles", async (req, res) => {
  try {
    const { outletId, topicId } = req.query;

    const conditions = [];
    if (outletId) conditions.push(eq(outletTopicArticles.outletId, outletId as string));
    if (topicId) conditions.push(eq(outletTopicArticles.topicId, topicId as string));

    let query = db.select().from(outletTopicArticles);
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length === 2) {
      query = query.where(and(conditions[0], conditions[1])) as typeof query;
    }

    const rows = await query.orderBy(outletTopicArticles.createdAt);
    res.json({ links: rows });
  } catch (err) {
    console.error("[Articles Service] Error listing outlet-topic-article links:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
