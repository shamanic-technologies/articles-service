import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_HEADERS = {
  orgId: "a0000000-0000-4000-8000-000000000001",
  userId: "b0000000-0000-4000-8000-000000000001",
  runId: "c0000000-0000-4000-8000-000000000001",
};

function mockFetchResponse(json: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      content: JSON.stringify(json),
      json,
      tokensInput: 100,
      tokensOutput: 50,
      model: "claude-haiku-4-5",
    }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CHAT_SERVICE_URL = "http://chat-service:3000";
  process.env.CHAT_SERVICE_API_KEY = "test-chat-key";
});

describe("extractMetadataFromMarkdown", () => {
  it("calls chat-service /complete with correct headers and body", async () => {
    const json = { isArticle: true, authors: [{ type: "person", firstName: "Sarah", lastName: "Perez" }], publishedAt: "2025-03-20T00:00:00Z" };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await extractMetadataFromMarkdown("# Article\nBy Sarah Perez", TEST_HEADERS);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat-service:3000/complete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-API-Key": "test-chat-key",
          "x-org-id": TEST_HEADERS.orgId,
          "x-user-id": TEST_HEADERS.userId,
          "x-run-id": TEST_HEADERS.runId,
        }),
      }),
    );

    // Verify body includes responseFormat, provider, and model
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.responseFormat).toBe("json");
    expect(body.provider).toBe("google");
    expect(body.model).toBe("flash-lite");
    expect(body.systemPrompt).toBeDefined();
    expect(body.maxTokens).toBe(512);
  });

  it("extracts person authors and publishedAt from json field", async () => {
    const json = { isArticle: true, authors: [{ type: "person", firstName: "Sarah", lastName: "Perez" }], publishedAt: "2025-03-20T00:00:00Z" };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# Article\nBy Sarah Perez\nPublished March 20, 2025", TEST_HEADERS);

    expect(result.isArticle).toBe(true);
    expect(result.authors).toEqual([{ type: "person", firstName: "Sarah", lastName: "Perez" }]);
    expect(result.publishedAt).toBe("2025-03-20T00:00:00Z");
  });

  it("handles organization authors", async () => {
    const json = { isArticle: true, authors: [{ type: "organization", firstName: "", lastName: "Reuters" }], publishedAt: "2025-03-20T00:00:00Z" };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# News\nBy Reuters", TEST_HEADERS);

    expect(result.authors).toEqual([{ type: "organization", firstName: "", lastName: "Reuters" }]);
  });

  it("returns isArticle=false for non-article pages", async () => {
    const json = { isArticle: false, authors: [], publishedAt: null };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("Welcome to our homepage!", TEST_HEADERS);

    expect(result.isArticle).toBe(false);
    expect(result.authors).toEqual([]);
    expect(result.publishedAt).toBeNull();
  });

  it("returns empty result when chat-service returns no json field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: "I cannot extract this information",
        tokensInput: 100,
        tokensOutput: 50,
        model: "claude-haiku-4-5",
      }),
    }));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("Some random text", TEST_HEADERS);

    expect(result.isArticle).toBe(false);
    expect(result.authors).toEqual([]);
    expect(result.publishedAt).toBeNull();
  });

  it("truncates long articles to 4000 chars", async () => {
    const json = { isArticle: true, authors: [], publishedAt: null };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const longArticle = "x".repeat(10000);
    await extractMetadataFromMarkdown(longArticle, TEST_HEADERS);

    const fetchMock = vi.mocked(fetch);
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    // Message includes prompt prefix + truncated content (4000 chars)
    expect(body.message.length).toBeLessThan(4200);
  });

  it("handles mixed person and organization authors", async () => {
    const json = {
      isArticle: true,
      authors: [
        { type: "person", firstName: "J.", lastName: "Smith" },
        { type: "organization", firstName: "", lastName: "AP News" },
      ],
      publishedAt: "2025-01-15T14:30:00+01:00",
    };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# Story\nBy J. Smith and AP News", TEST_HEADERS);

    expect(result.authors).toHaveLength(2);
    expect(result.authors[0]).toEqual({ type: "person", firstName: "J.", lastName: "Smith" });
    expect(result.authors[1]).toEqual({ type: "organization", firstName: "", lastName: "AP News" });
    expect(result.publishedAt).toBe("2025-01-15T14:30:00+01:00");
  });

  it("throws when chat-service returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("Upstream unavailable"),
    }));

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await expect(extractMetadataFromMarkdown("# Article", TEST_HEADERS))
      .rejects.toThrow("Chat-service returned 502");
  });

  it("throws when CHAT_SERVICE_URL is not set", async () => {
    delete process.env.CHAT_SERVICE_URL;

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await expect(extractMetadataFromMarkdown("# Article", TEST_HEADERS))
      .rejects.toThrow("CHAT_SERVICE_URL and CHAT_SERVICE_API_KEY must be set");
  });

  it("forwards optional headers (workflow, feature, brand, campaign)", async () => {
    const json = { isArticle: true, authors: [], publishedAt: null };
    vi.stubGlobal("fetch", mockFetchResponse(json));

    const headers = {
      ...TEST_HEADERS,
      workflowSlug: "discover-articles",
      featureSlug: "pr-outreach",
      brandId: "brand-123",
      campaignId: "campaign-456",
    };

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await extractMetadataFromMarkdown("# Article", headers);

    const fetchMock = vi.mocked(fetch);
    const calledHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(calledHeaders["x-workflow-slug"]).toBe("discover-articles");
    expect(calledHeaders["x-feature-slug"]).toBe("pr-outreach");
    expect(calledHeaders["x-brand-id"]).toBe("brand-123");
    expect(calledHeaders["x-campaign-id"]).toBe("campaign-456");
  });
});
