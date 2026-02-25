import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { articles, searchedJournalistArticles } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateJournalistArticleBodySchema } from "../schemas.js";

const router = Router();

// POST /v1/journalist-articles — link article to journalist
router.post("/v1/journalist-articles", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateJournalistArticleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [link] = await db
      .insert(searchedJournalistArticles)
      .values(parsed.data)
      .onConflictDoNothing()
      .returning();

    if (!link) {
      // Already exists — fetch it
      const [existing] = await db
        .select()
        .from(searchedJournalistArticles)
        .where(
          eq(searchedJournalistArticles.articleId, parsed.data.articleId)
        )
        .limit(1);
      res.json(existing);
      return;
    }

    res.json(link);
  } catch (err) {
    console.error("[Articles Service] Error creating journalist-article link:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/journalist-articles/:journalistId — articles linked to journalist
router.get("/v1/journalist-articles/:journalistId", async (req, res) => {
  try {
    const rows = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(searchedJournalistArticles, eq(articles.id, searchedJournalistArticles.articleId))
      .where(eq(searchedJournalistArticles.journalistId, req.params.journalistId))
      .orderBy(articles.createdAt);

    res.json({ articles: rows.map((r) => r.article) });
  } catch (err) {
    console.error("[Articles Service] Error fetching journalist articles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
