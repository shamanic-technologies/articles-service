-- Add extracted_at column to articles for LLM extraction cache (6-month TTL)
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "extracted_at" timestamp with time zone;
