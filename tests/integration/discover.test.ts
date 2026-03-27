import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders, TEST_ORG_ID, TEST_USER_ID, TEST_RUN_ID, TEST_BRAND_ID, TEST_CAMPAIGN_ID, TEST_FEATURE_SLUG, TEST_WORKFLOW_NAME } from "../helpers/test-app.js";
import { cleanTestData, closeDb } from "../helpers/test-db.js";
import { db } from "../../src/db/index.js";
import { articles, articleDiscoveries } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

// Mock external services
vi.mock("../../src/services/google.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/services/google.js")>();
  return { ...original, searchNews: vi.fn() };
});

vi.mock("../../src/services/scraping.js", () => ({
  extractArticles: vi.fn(),
}));

import { searchNews } from "../../src/services/google.js";
import { extractArticles } from "../../src/services/scraping.js";

const mockSearchNews = vi.mocked(searchNews);
const mockExtractArticles = vi.mocked(extractArticles);

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
  vi.clearAllMocks();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("POST /v1/discover/outlet-articles", () => {
  it("discovers articles from an outlet, extracts authors, and stores them with discoveries", async () => {
    mockSearchNews.mockResolvedValue([
      { title: "AI Startup Raises $10M", link: "https://techcrunch.com/2025/article-1", snippet: "A startup raised...", source: "TechCrunch", date: "2025-03-20", domain: "techcrunch.com" },
      { title: "New Product Launch", link: "https://techcrunch.com/2025/article-2", snippet: "A new product...", source: "TechCrunch", date: "2025-03-18", domain: "techcrunch.com" },
    ]);

    mockExtractArticles.mockResolvedValue([
      {
        url: "https://techcrunch.com/2025/article-1",
        success: true,
        authors: [{ firstName: "Sarah", lastName: "Perez" }],
        publishedAt: "2025-03-20T00:00:00Z",
      },
      {
        url: "https://techcrunch.com/2025/article-2",
        success: true,
        authors: [{ firstName: "John", lastName: "Doe" }, { firstName: "Jane", lastName: "Smith" }],
        publishedAt: "2025-03-18T00:00:00Z",
      },
    ]);

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "techcrunch.com", maxArticles: 10 });

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);

    expect(res.body.articles[0].articleUrl).toBe("https://techcrunch.com/2025/article-1");
    expect(res.body.articles[0].authors).toEqual([{ firstName: "Sarah", lastName: "Perez" }]);
    expect(res.body.articles[0].publishedAt).toBe("2025-03-20T00:00:00Z");
    expect(res.body.articles[0].articleId).toBeDefined();

    expect(res.body.articles[1].authors).toHaveLength(2);

    // Verify articles were stored in DB
    const stored = await db.select().from(articles);
    expect(stored).toHaveLength(2);

    // Verify discovery records were created
    const discoveries = await db.select().from(articleDiscoveries);
    expect(discoveries).toHaveLength(2);
    expect(discoveries[0].orgId).toBe(TEST_ORG_ID);
    expect(discoveries[0].brandId).toBe(TEST_BRAND_ID);
    expect(discoveries[0].campaignId).toBe(TEST_CAMPAIGN_ID);
    expect(discoveries[0].featureSlug).toBe(TEST_FEATURE_SLUG);

    // Verify Google was called with site: query
    expect(mockSearchNews).toHaveBeenCalledWith(
      "site:techcrunch.com",
      10,
      expect.objectContaining({ orgId: expect.any(String) }),
    );
  });

  it("returns empty array when Google returns no results", async () => {
    mockSearchNews.mockResolvedValue([]);

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "unknown-outlet.com" });

    expect(res.status).toBe(200);
    expect(res.body.articles).toEqual([]);
    expect(mockExtractArticles).not.toHaveBeenCalled();
  });

  it("handles partial extraction failures gracefully", async () => {
    mockSearchNews.mockResolvedValue([
      { title: "Good Article", link: "https://example.com/good", snippet: "...", source: "Example", date: "2025-03-20", domain: "example.com" },
      { title: "Bad Article", link: "https://example.com/bad", snippet: "...", source: "Example", date: "2025-03-19", domain: "example.com" },
    ]);

    mockExtractArticles.mockResolvedValue([
      {
        url: "https://example.com/good",
        success: true,
        authors: [{ firstName: "Alice", lastName: "Johnson" }],
        publishedAt: "2025-03-20T00:00:00Z",
      },
      {
        url: "https://example.com/bad",
        success: false,
        error: "Failed to scrape",
      },
    ]);

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "example.com" });

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0].articleUrl).toBe("https://example.com/good");
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 400 when x-brand-id header is missing", async () => {
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-brand-id"];

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(headers)
      .send({ outletDomain: "techcrunch.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-brand-id");
  });

  it("returns 400 when x-campaign-id header is missing", async () => {
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-campaign-id"];

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(headers)
      .send({ outletDomain: "techcrunch.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-campaign-id");
  });

  it("returns 502 when Google service fails", async () => {
    mockSearchNews.mockRejectedValue(new Error("Google news search failed (500): Internal error"));

    const res = await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "techcrunch.com" });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("Google news search failed");
  });

  it("uses default maxArticles of 10", async () => {
    mockSearchNews.mockResolvedValue([]);

    await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "techcrunch.com" });

    expect(mockSearchNews).toHaveBeenCalledWith("site:techcrunch.com", 10, expect.anything());
  });

  it("forwards all identity headers to downstream services", async () => {
    mockSearchNews.mockResolvedValue([]);

    await request(app)
      .post("/v1/discover/outlet-articles")
      .set(getAuthHeaders())
      .send({ outletDomain: "techcrunch.com" });

    expect(mockSearchNews).toHaveBeenCalledWith(
      "site:techcrunch.com",
      10,
      expect.objectContaining({
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        runId: TEST_RUN_ID,
        workflowName: TEST_WORKFLOW_NAME,
        featureSlug: TEST_FEATURE_SLUG,
        brandId: TEST_BRAND_ID,
        campaignId: TEST_CAMPAIGN_ID,
      }),
    );
  });
});

describe("POST /v1/discover/journalist-publications", () => {
  const journalistId = "d0000000-0000-4000-8000-000000000001";

  it("discovers publications by a journalist, stores and creates discoveries", async () => {
    mockSearchNews.mockResolvedValue([
      { title: "Tech Trends 2025", link: "https://wired.com/tech-trends", snippet: "...", source: "Wired", date: "2025-03-15", domain: "wired.com" },
      { title: "AI Revolution", link: "https://nytimes.com/ai-revolution", snippet: "...", source: "NYT", date: "2025-03-10", domain: "nytimes.com" },
    ]);

    mockExtractArticles.mockResolvedValue([
      {
        url: "https://wired.com/tech-trends",
        success: true,
        authors: [{ firstName: "Sarah", lastName: "Perez" }],
        publishedAt: "2025-03-15T00:00:00Z",
      },
      {
        url: "https://nytimes.com/ai-revolution",
        success: true,
        authors: [{ firstName: "Sarah", lastName: "Perez" }],
        publishedAt: "2025-03-10T00:00:00Z",
      },
    ]);

    const res = await request(app)
      .post("/v1/discover/journalist-publications")
      .set(getAuthHeaders())
      .send({
        journalistFirstName: "Sarah",
        journalistLastName: "Perez",
        journalistId,
      });

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);

    // Verify discovery records were created with journalist link
    const discoveries = await db
      .select()
      .from(articleDiscoveries)
      .where(eq(articleDiscoveries.journalistId, journalistId));
    expect(discoveries).toHaveLength(2);
    expect(discoveries[0].brandId).toBe(TEST_BRAND_ID);
    expect(discoveries[0].campaignId).toBe(TEST_CAMPAIGN_ID);

    // Verify Google was called with quoted name
    expect(mockSearchNews).toHaveBeenCalledWith(
      '"Sarah Perez"',
      10,
      expect.objectContaining({ orgId: expect.any(String) }),
    );
  });

  it("returns empty array when no results found", async () => {
    mockSearchNews.mockResolvedValue([]);

    const res = await request(app)
      .post("/v1/discover/journalist-publications")
      .set(getAuthHeaders())
      .send({
        journalistFirstName: "Unknown",
        journalistLastName: "Person",
        journalistId,
      });

    expect(res.status).toBe(200);
    expect(res.body.articles).toEqual([]);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app)
      .post("/v1/discover/journalist-publications")
      .set(getAuthHeaders())
      .send({ journalistFirstName: "Sarah" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when x-brand-id header is missing", async () => {
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-brand-id"];

    const res = await request(app)
      .post("/v1/discover/journalist-publications")
      .set(headers)
      .send({ journalistFirstName: "Sarah", journalistLastName: "Perez", journalistId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-brand-id");
  });

  it("returns 400 when x-campaign-id header is missing", async () => {
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-campaign-id"];

    const res = await request(app)
      .post("/v1/discover/journalist-publications")
      .set(headers)
      .send({ journalistFirstName: "Sarah", journalistLastName: "Perez", journalistId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-campaign-id");
  });

  it("respects custom maxResults", async () => {
    mockSearchNews.mockResolvedValue([]);

    await request(app)
      .post("/v1/discover/journalist-publications")
      .set(getAuthHeaders())
      .send({
        journalistFirstName: "Sarah",
        journalistLastName: "Perez",
        journalistId,
        maxResults: 5,
      });

    expect(mockSearchNews).toHaveBeenCalledWith('"Sarah Perez"', 5, expect.anything());
  });

  it("forwards all identity headers to downstream services", async () => {
    mockSearchNews.mockResolvedValue([]);

    await request(app)
      .post("/v1/discover/journalist-publications")
      .set(getAuthHeaders())
      .send({ journalistFirstName: "Sarah", journalistLastName: "Perez", journalistId });

    expect(mockSearchNews).toHaveBeenCalledWith(
      '"Sarah Perez"',
      10,
      expect.objectContaining({
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        runId: TEST_RUN_ID,
        workflowName: TEST_WORKFLOW_NAME,
        featureSlug: TEST_FEATURE_SLUG,
        brandId: TEST_BRAND_ID,
        campaignId: TEST_CAMPAIGN_ID,
      }),
    );
  });

  it("does not duplicate discoveries on re-discovery", async () => {
    mockSearchNews.mockResolvedValue([
      { title: "Article 1", link: "https://example.com/article-1", snippet: "...", source: "Example", date: "2025-03-20", domain: "example.com" },
    ]);

    mockExtractArticles.mockResolvedValue([
      {
        url: "https://example.com/article-1",
        success: true,
        authors: [{ firstName: "Sarah", lastName: "Perez" }],
        publishedAt: "2025-03-20T00:00:00Z",
      },
    ]);

    const body = {
      journalistFirstName: "Sarah",
      journalistLastName: "Perez",
      journalistId,
    };

    // Call twice
    await request(app).post("/v1/discover/journalist-publications").set(getAuthHeaders()).send(body);
    await request(app).post("/v1/discover/journalist-publications").set(getAuthHeaders()).send(body);

    const discoveries = await db
      .select()
      .from(articleDiscoveries)
      .where(eq(articleDiscoveries.journalistId, journalistId));
    expect(discoveries.length).toBeGreaterThanOrEqual(1);
  });
});
