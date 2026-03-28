ALTER TABLE "article_discoveries" ADD COLUMN "workflow_slug" text;
--> statement-breakpoint
CREATE INDEX "idx_ad_workflow_slug" ON "article_discoveries" USING btree ("workflow_slug");
--> statement-breakpoint
CREATE INDEX "idx_ad_feature_slug" ON "article_discoveries" USING btree ("feature_slug");
