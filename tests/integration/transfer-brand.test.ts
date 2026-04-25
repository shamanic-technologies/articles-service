import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, TEST_ORG_ID, TEST_BRAND_ID, TEST_CAMPAIGN_ID } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, insertTestDiscovery, closeDb } from "../helpers/test-db.js";
import { db } from "../../src/db/index.js";
import { articleDiscoveries } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

const app = createTestApp();

const SOURCE_ORG = "a0000000-0000-4000-a000-000000000001";
const TARGET_ORG = "d0000000-0000-4000-a000-000000000099";
const BRAND_A = TEST_BRAND_ID; // e0000000-0000-4000-8000-000000000001
const BRAND_B = "e0000000-0000-4000-8000-000000000002";

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("POST /internal/transfer-brand", () => {
  it("transfers solo-brand discovery rows to the target org", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 1 },
    ]);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].orgId).toBe(TARGET_ORG);
  });

  it("skips co-branding rows (multiple brand IDs)", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-2" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A, BRAND_B],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 0 },
    ]);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows[0].orgId).toBe(SOURCE_ORG);
  });

  it("does not affect rows belonging to a different org", async () => {
    const otherOrg = "d0000000-0000-4000-a000-000000000088";
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-3" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: otherOrg,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 0 },
    ]);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows[0].orgId).toBe(otherOrg);
  });

  it("is idempotent — second call is a no-op", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-4" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 0 },
    ]);
  });

  it("does not affect rows with a different brand", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-5" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_B],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 0 },
    ]);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows[0].orgId).toBe(SOURCE_ORG);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request body");
  });

  it("rewrites brand_ids when targetBrandId is provided", async () => {
    const targetBrand = "e0000000-0000-4000-8000-000000000099";
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-rewrite-1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG, targetBrandId: targetBrand });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables).toEqual([
      { tableName: "article_discoveries", count: 1 },
    ]);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].orgId).toBe(TARGET_ORG);
    expect(rows[0].brandIds).toEqual([targetBrand]);
  });

  it("does not rewrite brand_ids when targetBrandId is absent", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-rewrite-2" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);

    const rows = await db.select().from(articleDiscoveries).where(eq(articleDiscoveries.articleId, article.id));
    expect(rows[0].orgId).toBe(TARGET_ORG);
    expect(rows[0].brandIds).toEqual([BRAND_A]);
  });

  it("does not require identity headers", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/transfer-6" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: SOURCE_ORG,
      brandIds: [BRAND_A],
      featureSlug: "test-feature",
      campaignId: TEST_CAMPAIGN_ID,
    });

    // No identity headers — should still work
    const res = await request(app)
      .post("/internal/transfer-brand")
      .send({ sourceBrandId: BRAND_A, sourceOrgId: SOURCE_ORG, targetOrgId: TARGET_ORG });

    expect(res.status).toBe(200);
    expect(res.body.updatedTables[0].count).toBe(1);
  });
});
