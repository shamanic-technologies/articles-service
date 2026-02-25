CREATE TABLE IF NOT EXISTS "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_url" text NOT NULL,
	"snippet" text,
	"og_description" text,
	"twitter_creator" text,
	"news_keywords" text,
	"article_published" text,
	"article_channel" text,
	"twitter_title" text,
	"article_section" text,
	"author" text,
	"og_title" text,
	"article_author" text,
	"twitter_description" text,
	"article_modified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outlet_topic_articles" (
	"outlet_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_topic_articles_outlet_id_topic_id_article_id_pk" PRIMARY KEY("outlet_id","topic_id","article_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "press_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "searched_journalist_articles" (
	"article_id" uuid NOT NULL,
	"journalist_id" uuid NOT NULL,
	CONSTRAINT "searched_journalist_articles_article_id_journalist_id_pk" PRIMARY KEY("article_id","journalist_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outlet_topic_articles" ADD CONSTRAINT "outlet_topic_articles_topic_id_press_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."press_topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outlet_topic_articles" ADD CONSTRAINT "outlet_topic_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "searched_journalist_articles" ADD CONSTRAINT "searched_journalist_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_articles_url" ON "articles" USING btree ("article_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_articles_created_at" ON "articles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ota_outlet" ON "outlet_topic_articles" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ota_topic" ON "outlet_topic_articles" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ota_article" ON "outlet_topic_articles" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_press_topics_name" ON "press_topics" USING btree ("topic_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sja_journalist" ON "searched_journalist_articles" USING btree ("journalist_id");