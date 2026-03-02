import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp, getIdentityHeaders } from "../helpers/test-app.js";

const app = createTestApp();

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "articles-service" });
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/nonexistent").set(getIdentityHeaders());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("returns 400 for unknown routes without identity headers", async () => {
    const res = await request(app).get("/nonexistent");
    expect(res.status).toBe(400);
  });
});
