import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders } from "../helpers/test-app.js";
import { cleanTestData, insertTestTopic, closeDb } from "../helpers/test-db.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("POST /v1/topics", () => {
  it("creates a new topic", async () => {
    const res = await request(app)
      .post("/v1/topics")
      .set(getAuthHeaders())
      .send({ topicName: "Technology" });

    expect(res.status).toBe(200);
    expect(res.body.topicName).toBe("Technology");
    expect(res.body.id).toBeDefined();
  });

  it("upserts an existing topic by name", async () => {
    await request(app)
      .post("/v1/topics")
      .set(getAuthHeaders())
      .send({ topicName: "Technology" });

    const res = await request(app)
      .post("/v1/topics")
      .set(getAuthHeaders())
      .send({ topicName: "Technology" });

    expect(res.status).toBe(200);
    expect(res.body.topicName).toBe("Technology");
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/v1/topics")
      .send({ topicName: "Technology" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for empty topic name", async () => {
    const res = await request(app)
      .post("/v1/topics")
      .set(getAuthHeaders())
      .send({ topicName: "" });

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/topics", () => {
  it("lists all topics", async () => {
    await insertTestTopic("Technology");
    await insertTestTopic("Science");

    const res = await request(app).get("/v1/topics");
    expect(res.status).toBe(200);
    expect(res.body.topics).toHaveLength(2);
  });
});

describe("POST /v1/topics/bulk", () => {
  it("bulk upserts topics", async () => {
    const res = await request(app)
      .post("/v1/topics/bulk")
      .set(getAuthHeaders())
      .send({
        topics: [
          { topicName: "Technology" },
          { topicName: "Science" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.topics).toHaveLength(2);
  });

  it("handles empty array", async () => {
    const res = await request(app)
      .post("/v1/topics/bulk")
      .set(getAuthHeaders())
      .send({ topics: [] });

    expect(res.status).toBe(200);
    expect(res.body.topics).toHaveLength(0);
  });
});
