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

  const { sourceBrandId, sourceOrgId, targetOrgId, targetBrandId } = parsed.data;

  try {
    // Step 1: Move solo-brand rows from sourceOrg to targetOrg
    const step1 = await pgSql`
      UPDATE article_discoveries
      SET org_id = ${targetOrgId}::uuid
      WHERE org_id = ${sourceOrgId}::uuid
        AND array_length(brand_ids, 1) = 1
        AND brand_ids @> ARRAY[${sourceBrandId}]::uuid[]
    `;

    // Step 2: Rewrite brand references (all rows, including co-brand, no org filter)
    let step2Count = 0;
    if (targetBrandId) {
      const step2 = await pgSql`
        UPDATE article_discoveries
        SET brand_ids = array_replace(brand_ids, ${sourceBrandId}::uuid, ${targetBrandId}::uuid)
        WHERE brand_ids @> ARRAY[${sourceBrandId}]::uuid[]
      `;
      step2Count = step2.count;
    }

    res.json({
      updatedTables: [
        { tableName: "article_discoveries", count: step1.count + step2Count },
      ],
    });
  } catch (err) {
    console.error("[Articles Service] Error transferring brand:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
