-- Migrate brand_id (single UUID) to brand_ids (UUID array) for multi-brand campaign support
ALTER TABLE "article_discoveries" ADD COLUMN "brand_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[];
--> statement-breakpoint
UPDATE "article_discoveries" SET "brand_ids" = ARRAY["brand_id"];
--> statement-breakpoint
ALTER TABLE "article_discoveries" ALTER COLUMN "brand_ids" DROP DEFAULT;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_ad_brand";
--> statement-breakpoint
ALTER TABLE "article_discoveries" DROP COLUMN "brand_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_brand_ids" ON "article_discoveries" USING gin ("brand_ids");
