import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import {
  createTestApp,
  getAuthHeaders,
  getIdentityHeaders,
  TEST_ORG_ID,
  TEST_BRAND_ID,
  TEST_CAMPAIGN_ID,
  TEST_USER_ID,
} from "../helpers/test-app.js";
import {
  cleanTestData,
  closeDb,
  insertTestArticle,
  insertTestMention,
} from "../helpers/test-db.js";
import { db } from "../../src/db/index.js";
import { articles, articleMentions } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

// Mock only the extraction pipeline; keep serializeAuthors / toPublishedTimestamp real.
vi.mock("../../src/services/scraping.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/services/scraping.js")>();
  return { ...original, extractArticles: vi.fn() };
});

import { extractArticles } from "../../src/services/scraping.js";
const mockExtractArticles = vi.mocked(extractArticles);

const OUTLET_ID = "d0000000-0000-4000-8000-000000000001";
const JOURNALIST_ID = "d0000000-0000-4000-8000-000000000002";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
  vi.clearAllMocks();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    outletId: OUTLET_ID,
    journalistId: JOURNALIST_ID,
    hasMention: true,
    hasQuote: true,
    hasLink: true,
    linkDofollow: true,
    placementType: "organic",
    isPaid: false,
    ...overrides,
  };
}

describe("POST /v1/mentions", () => {
  it("records a mention for an existing article with all characteristics", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-1", ogTitle: "We were featured" });

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: article.id }));

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(article.id);
    expect(res.body.orgId).toBe(TEST_ORG_ID);
    expect(res.body.brandIds).toEqual([TEST_BRAND_ID]);
    expect(res.body.campaignId).toBe(TEST_CAMPAIGN_ID);
    expect(res.body.outletId).toBe(OUTLET_ID);
    expect(res.body.journalistId).toBe(JOURNALIST_ID);
    expect(res.body.hasMention).toBe(true);
    expect(res.body.hasQuote).toBe(true);
    expect(res.body.hasLink).toBe(true);
    expect(res.body.linkDofollow).toBe(true);
    expect(res.body.placementType).toBe("organic");
    expect(res.body.isPaid).toBe(false);
    expect(res.body.costUsdCents).toBeNull();
    expect(res.body.source).toBe("manual");
    expect(res.body.createdBy).toBe(TEST_USER_ID);
    expect(res.body.id).toBeDefined();
  });

  it("scrapes + upserts the article when given articleUrl (fills wordCount + publishedAt)", async () => {
    mockExtractArticles.mockResolvedValue([
      {
        url: "https://outlet.com/fresh-win",
        success: true,
        authors: [{ type: "person", firstName: "Sarah", lastName: "Perez" }],
        publishedAt: "2025-03-20T00:00:00Z",
        markdownLength: 5200,
        wordCount: 850,
      },
    ]);

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleUrl: "https://outlet.com/fresh-win" }));

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBeDefined();

    const [article] = await db.select().from(articles).where(eq(articles.id, res.body.articleId));
    expect(article.articleUrl).toBe("https://outlet.com/fresh-win");
    expect(article.wordCount).toBe(850);
    expect(article.publishedAt).toBeTruthy();
    expect(article.author).toBe("person:Sarah Perez");
  });

  it("accepts an organic free placement with no link", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-2" });

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: article.id, hasLink: false, linkDofollow: undefined, isPaid: false }));

    expect(res.status).toBe(200);
    expect(res.body.hasLink).toBe(false);
    expect(res.body.linkDofollow).toBeNull();
    expect(res.body.costUsdCents).toBeNull();
  });

  it("accepts a sponsored paid placement with spend", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-3" });

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: article.id, placementType: "sponsored", isPaid: true, costUsdCents: 200000 }));

    expect(res.status).toBe(200);
    expect(res.body.placementType).toBe("sponsored");
    expect(res.body.isPaid).toBe(true);
    expect(res.body.costUsdCents).toBe(200000);
  });

  it("returns 400 when isPaid is true but costUsdCents is missing", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-4" });

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: article.id, isPaid: true }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("costUsdCents");
  });

  it("returns 400 when hasLink is false but linkDofollow is provided", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-5" });

    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: article.id, hasLink: false, linkDofollow: true }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("linkDofollow");
  });

  it("returns 400 when neither articleId nor articleUrl is given", async () => {
    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("articleId or articleUrl");
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/v1/mentions")
      .set(getIdentityHeaders())
      .send(validBody({ articleId: "550e8400-e29b-41d4-a716-446655440000" }));

    expect(res.status).toBe(401);
  });

  it("returns 400 when x-brand-id / x-campaign-id headers are missing", async () => {
    const article = await insertTestArticle({ articleUrl: "https://outlet.com/win-6" });
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-brand-id"];

    const res = await request(app)
      .post("/v1/mentions")
      .set(headers)
      .send(validBody({ articleId: article.id }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-brand-id");
  });

  it("returns 404 when articleId does not exist", async () => {
    const res = await request(app)
      .post("/v1/mentions")
      .set(getAuthHeaders())
      .send(validBody({ articleId: "11111111-1111-4111-8111-111111111111" }));

    expect(res.status).toBe(404);
  });
});

describe("GET /v1/mentions", () => {
  async function seedMention(overrides: Record<string, unknown> = {}) {
    const article = await insertTestArticle({ articleUrl: `https://outlet.com/${Math.random()}`, ogTitle: "Featured" });
    return insertTestMention({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      outletId: OUTLET_ID,
      journalistId: JOURNALIST_ID,
      campaignId: TEST_CAMPAIGN_ID,
      ...overrides,
    });
  }

  it("lists mentions for the org joined with article data", async () => {
    await seedMention();

    const res = await request(app).get("/v1/mentions").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.mentions).toHaveLength(1);
    expect(res.body.mentions[0].mention.outletId).toBe(OUTLET_ID);
    expect(res.body.mentions[0].article.ogTitle).toBe("Featured");
  });

  it("filters by journalistId", async () => {
    const otherJournalist = "d0000000-0000-4000-8000-000000000099";
    await seedMention();
    await seedMention({ journalistId: otherJournalist });

    const res = await request(app)
      .get(`/v1/mentions?journalistId=${JOURNALIST_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.mentions).toHaveLength(1);
    expect(res.body.mentions[0].mention.journalistId).toBe(JOURNALIST_ID);
  });

  it("filters by campaignId", async () => {
    await seedMention();
    const res = await request(app)
      .get(`/v1/mentions?campaignId=${TEST_CAMPAIGN_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.mentions).toHaveLength(1);
  });

  it("scopes to org from headers (other org sees nothing)", async () => {
    await seedMention({ orgId: "a0000000-0000-0000-0000-000000000099" });

    const res = await request(app).get("/v1/mentions").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.mentions).toHaveLength(0);
  });
});
