-- Drop legacy tables (order matters for FK constraints)
DROP TABLE IF EXISTS "searched_journalist_articles";
--> statement-breakpoint
DROP TABLE IF EXISTS "outlet_topic_articles";
--> statement-breakpoint
-- Rename press_topics to topics (idempotent: skip if already renamed)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'press_topics') THEN
    ALTER TABLE "press_topics" RENAME TO "topics";
  END IF;
END $$;
--> statement-breakpoint
-- Update the unique index name for topics
DROP INDEX IF EXISTS "idx_press_topics_name";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_topics_name" ON "topics" USING btree ("topic_name");
--> statement-breakpoint
-- Create article_discoveries table
CREATE TABLE IF NOT EXISTS "article_discoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"feature_slug" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"outlet_id" uuid,
	"journalist_id" uuid,
	"topic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "article_discoveries" ADD CONSTRAINT "article_discoveries_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "article_discoveries" ADD CONSTRAINT "article_discoveries_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_article" ON "article_discoveries" USING btree ("article_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_org" ON "article_discoveries" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_brand" ON "article_discoveries" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_campaign" ON "article_discoveries" USING btree ("campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_outlet" ON "article_discoveries" USING btree ("outlet_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_journalist" ON "article_discoveries" USING btree ("journalist_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_topic" ON "article_discoveries" USING btree ("topic_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_article_campaign" ON "article_discoveries" USING btree ("article_id", "campaign_id");
