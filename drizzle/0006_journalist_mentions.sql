-- Add normalized article length + publish date for placement reporting
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "word_count" integer;
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
-- Earned-media placements: a journalist published an article mentioning a brand after outreach
CREATE TABLE IF NOT EXISTS "article_mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "brand_ids" uuid[] NOT NULL,
  "outlet_id" uuid NOT NULL,
  "journalist_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "pitch_id" uuid,
  "has_mention" boolean NOT NULL,
  "has_quote" boolean NOT NULL,
  "has_link" boolean NOT NULL,
  "link_dofollow" boolean,
  "placement_type" text NOT NULL,
  "is_paid" boolean NOT NULL,
  "cost_usd_cents" integer,
  "source" text DEFAULT 'manual' NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "article_mentions" ADD CONSTRAINT "article_mentions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "articles"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_article" ON "article_mentions" ("article_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_org" ON "article_mentions" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_brand_ids" ON "article_mentions" USING gin ("brand_ids");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_outlet" ON "article_mentions" ("outlet_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_journalist" ON "article_mentions" ("journalist_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_am_campaign" ON "article_mentions" ("campaign_id");
