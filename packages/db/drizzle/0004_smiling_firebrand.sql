ALTER TABLE "crews" ADD COLUMN "city_slug" text;--> statement-breakpoint
ALTER TABLE "crews" ADD COLUMN "city_province" text;--> statement-breakpoint
ALTER TABLE "crews" ADD COLUMN "city_lat" double precision;--> statement-breakpoint
ALTER TABLE "crews" ADD COLUMN "city_lng" double precision;--> statement-breakpoint
CREATE INDEX "crews_city_slug_idx" ON "crews" USING btree ("city_slug");