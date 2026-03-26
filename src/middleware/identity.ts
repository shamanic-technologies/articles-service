import { Request, Response, NextFunction } from "express";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireIdentity(req: Request, res: Response, next: NextFunction) {
  const orgId = req.headers["x-org-id"] as string | undefined;
  const userId = req.headers["x-user-id"] as string | undefined;
  const runId = req.headers["x-run-id"] as string | undefined;
  const featureSlug = req.headers["x-feature-slug"] as string | undefined;
  const campaignId = req.headers["x-campaign-id"] as string | undefined;

  if (!orgId || !userId || !runId) {
    res.status(400).json({
      error: "Missing required headers: x-org-id, x-user-id, and x-run-id",
    });
    return;
  }

  if (!UUID_REGEX.test(orgId) || !UUID_REGEX.test(userId) || !UUID_REGEX.test(runId)) {
    res.status(400).json({
      error: "x-org-id, x-user-id, and x-run-id must be valid UUIDs",
    });
    return;
  }

  if (featureSlug !== undefined && (typeof featureSlug !== "string" || featureSlug.trim() === "")) {
    res.status(400).json({
      error: "x-feature-slug must be a non-empty string when provided",
    });
    return;
  }

  if (campaignId !== undefined && !UUID_REGEX.test(campaignId)) {
    res.status(400).json({
      error: "x-campaign-id must be a valid UUID when provided",
    });
    return;
  }

  next();
}
