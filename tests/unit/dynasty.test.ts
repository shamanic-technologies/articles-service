import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

beforeEach(() => {
  fetchSpy.mockReset();
  process.env.WORKFLOW_SERVICE_URL = "http://workflow:3000";
  process.env.WORKFLOW_SERVICE_API_KEY = "wf-key";
  process.env.FEATURES_SERVICE_URL = "http://features:3000";
  process.env.FEATURES_SERVICE_API_KEY = "feat-key";
});

afterEach(() => {
  delete process.env.WORKFLOW_SERVICE_URL;
  delete process.env.WORKFLOW_SERVICE_API_KEY;
  delete process.env.FEATURES_SERVICE_URL;
  delete process.env.FEATURES_SERVICE_API_KEY;
});

// Import after global fetch is stubbed
import {
  resolveWorkflowDynastySlugs,
  resolveFeatureDynastySlugs,
  fetchAllWorkflowDynasties,
  fetchAllFeatureDynasties,
  buildSlugToDynastyMap,
} from "../../src/services/dynasty.js";

describe("resolveWorkflowDynastySlugs", () => {
  it("resolves dynasty slug to versioned slugs", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ workflowSlugs: ["cold-email", "cold-email-v2", "cold-email-v3"] }),
    });

    const result = await resolveWorkflowDynastySlugs("cold-email", {
      orgId: "org-1",
      userId: "user-1",
      runId: "run-1",
    });

    expect(result).toEqual(["cold-email", "cold-email-v2", "cold-email-v3"]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://workflow:3000/workflows/dynasty/slugs?workflowDynastySlug=cold-email");
    expect(opts.headers["X-API-Key"]).toBe("wf-key");
    expect(opts.headers["x-org-id"]).toBe("org-1");
  });

  it("returns empty array on HTTP error", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const result = await resolveWorkflowDynastySlugs("cold-email");
    expect(result).toEqual([]);
  });

  it("returns empty array when env vars not set", async () => {
    delete process.env.WORKFLOW_SERVICE_URL;
    const result = await resolveWorkflowDynastySlugs("cold-email");
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("resolveFeatureDynastySlugs", () => {
  it("resolves feature dynasty slug to versioned slugs", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ slugs: ["feat-alpha", "feat-alpha-v2"] }),
    });

    const result = await resolveFeatureDynastySlugs("feat-alpha");
    expect(result).toEqual(["feat-alpha", "feat-alpha-v2"]);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://features:3000/features/dynasty/slugs?dynastySlug=feat-alpha");
  });

  it("returns empty array when env vars not set", async () => {
    delete process.env.FEATURES_SERVICE_URL;
    const result = await resolveFeatureDynastySlugs("feat-alpha");
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns empty array on HTTP error", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 404 });
    const result = await resolveFeatureDynastySlugs("feat-alpha");
    expect(result).toEqual([]);
  });
});

describe("fetchAllWorkflowDynasties", () => {
  it("fetches all workflow dynasties", async () => {
    const remoteDynasties = [
      { workflowDynastySlug: "cold-email", workflowDynastyName: "Cold Email", workflowSlugs: ["cold-email", "cold-email-v2"] },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ dynasties: remoteDynasties }),
    });

    const result = await fetchAllWorkflowDynasties();
    expect(result).toEqual([
      { dynastySlug: "cold-email", slugs: ["cold-email", "cold-email-v2"] },
    ]);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://workflow:3000/workflows/dynasties");
  });

  it("returns empty array on failure", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchAllWorkflowDynasties();
    expect(result).toEqual([]);
  });
});

describe("fetchAllFeatureDynasties", () => {
  it("fetches all feature dynasties", async () => {
    const dynasties = [
      { dynastySlug: "feat-alpha", slugs: ["feat-alpha", "feat-alpha-v2"] },
    ];
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ dynasties }),
    });

    const result = await fetchAllFeatureDynasties();
    expect(result).toEqual(dynasties);
  });

  it("returns empty array when env not set", async () => {
    delete process.env.FEATURES_SERVICE_API_KEY;
    const result = await fetchAllFeatureDynasties();
    expect(result).toEqual([]);
  });
});

describe("buildSlugToDynastyMap", () => {
  it("builds correct reverse map", () => {
    const dynasties = [
      { dynastySlug: "cold-email", slugs: ["cold-email", "cold-email-v2", "cold-email-v3"] },
      { dynastySlug: "warm-intro", slugs: ["warm-intro", "warm-intro-v2"] },
    ];
    const map = buildSlugToDynastyMap(dynasties);

    expect(map.get("cold-email")).toBe("cold-email");
    expect(map.get("cold-email-v2")).toBe("cold-email");
    expect(map.get("cold-email-v3")).toBe("cold-email");
    expect(map.get("warm-intro")).toBe("warm-intro");
    expect(map.get("warm-intro-v2")).toBe("warm-intro");
    expect(map.get("unknown")).toBeUndefined();
  });

  it("handles empty dynasties array", () => {
    const map = buildSlugToDynastyMap([]);
    expect(map.size).toBe(0);
  });

  it("handles dynasty with empty slugs array", () => {
    const map = buildSlugToDynastyMap([{ dynastySlug: "empty", slugs: [] }]);
    expect(map.size).toBe(0);
  });
});
