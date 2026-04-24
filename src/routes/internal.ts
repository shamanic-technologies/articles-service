import { Router } from "express";
import { inArray } from "drizzle-orm";
import { db, sql as pgSql } from "../db/index.js";
import { articles } from "../db/schema.js";
import { TransferBrandBodySchema } from "../schemas.js";

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

// POST /internal/transfer-brand — re-assign solo-brand rows from one org to another
router.post("/internal/transfer-brand", async (req, res) => {
  const parsed = TransferBrandBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { brandId, sourceOrgId, targetOrgId } = parsed.data;

  try {
    const result = await pgSql`
      UPDATE article_discoveries
      SET org_id = ${targetOrgId}::uuid
      WHERE org_id = ${sourceOrgId}::uuid
        AND array_length(brand_ids, 1) = 1
        AND brand_ids @> ARRAY[${brandId}]::uuid[]
    `;

    res.json({
      updatedTables: [
        { tableName: "article_discoveries", count: result.count },
      ],
    });
  } catch (err) {
    console.error("[Articles Service] Error transferring brand:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
