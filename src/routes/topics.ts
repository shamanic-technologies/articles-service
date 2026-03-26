import { Router } from "express";
import { db } from "../db/index.js";
import { topics } from "../db/schema.js";
import { requireApiKey } from "../middleware/auth.js";
import { CreateTopicBodySchema, BulkCreateTopicsBodySchema } from "../schemas.js";

const router = Router();

// POST /v1/topics — create/upsert topic by name
router.post("/v1/topics", requireApiKey, async (req, res) => {
  try {
    const parsed = CreateTopicBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [topic] = await db
      .insert(topics)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: topics.topicName,
        set: { updatedAt: new Date() },
      })
      .returning();

    res.json(topic);
  } catch (err) {
    console.error("[Articles Service] Error creating topic:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /v1/topics — list all topics
router.get("/v1/topics", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(topics)
      .orderBy(topics.topicName);

    res.json({ topics: rows });
  } catch (err) {
    console.error("[Articles Service] Error listing topics:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /v1/topics/bulk — bulk upsert topics
router.post("/v1/topics/bulk", requireApiKey, async (req, res) => {
  try {
    const parsed = BulkCreateTopicsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.topics.length === 0) {
      res.json({ topics: [] });
      return;
    }

    const result = await db
      .insert(topics)
      .values(parsed.data.topics)
      .onConflictDoUpdate({
        target: topics.topicName,
        set: { updatedAt: new Date() },
      })
      .returning();

    res.json({ topics: result });
  } catch (err) {
    console.error("[Articles Service] Error bulk creating topics:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
