import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, getIdentityHeaders } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, closeDb } from "../helpers/test-db.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("GET /internal/articles/by-urls", () => {
  it("returns articles matching URLs", async () => {
    await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Article 1" });
    await insertTestArticle({ articleUrl: "https://example.com/2", ogTitle: "Article 2" });
    await insertTestArticle({ articleUrl: "https://example.com/3", ogTitle: "Article 3" });

    const res = await request(app)
      .get("/internal/articles/by-urls?urls=https://example.com/1,https://example.com/3")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
    const titles = res.body.articles.map((a: { ogTitle: string }) => a.ogTitle).sort();
    expect(titles).toEqual(["Article 1", "Article 3"]);
  });

  it("returns 400 without urls param", async () => {
    const res = await request(app)
      .get("/internal/articles/by-urls")
      .set(getIdentityHeaders());
    expect(res.status).toBe(400);
  });

  it("returns empty array for no matches", async () => {
    const res = await request(app)
      .get("/internal/articles/by-urls?urls=https://example.com/nonexistent")
      .set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
  });
});
