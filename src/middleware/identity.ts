import { Request, Response, NextFunction } from "express";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireIdentity(req: Request, res: Response, next: NextFunction) {
  const orgId = req.headers["x-org-id"] as string | undefined;
  const userId = req.headers["x-user-id"] as string | undefined;

  if (!orgId || !userId) {
    res.status(400).json({
      error: "Missing required identity headers: x-org-id and x-user-id",
    });
    return;
  }

  if (!UUID_REGEX.test(orgId) || !UUID_REGEX.test(userId)) {
    res.status(400).json({
      error: "x-org-id and x-user-id must be valid UUIDs",
    });
    return;
  }

  next();
}
