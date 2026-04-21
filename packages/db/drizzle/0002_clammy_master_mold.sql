CREATE TABLE "community_access_link_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"access_link_id" text NOT NULL,
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"reviewed_by_user_id" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_access_links" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"code" text NOT NULL,
	"default_role" text NOT NULL,
	"source_label" text,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_access_link_claims" ADD CONSTRAINT "community_access_link_claims_access_link_id_community_access_links_id_fk" FOREIGN KEY ("access_link_id") REFERENCES "public"."community_access_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_access_link_claims" ADD CONSTRAINT "community_access_link_claims_community_id_communities_organization_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_access_link_claims" ADD CONSTRAINT "community_access_link_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_access_link_claims" ADD CONSTRAINT "community_access_link_claims_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_access_links" ADD CONSTRAINT "community_access_links_community_id_communities_organization_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_access_links" ADD CONSTRAINT "community_access_links_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_access_link_claims_link_user_idx" ON "community_access_link_claims" USING btree ("access_link_id","user_id");--> statement-breakpoint
CREATE INDEX "community_access_link_claims_community_status_idx" ON "community_access_link_claims" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "community_access_link_claims_user_status_idx" ON "community_access_link_claims" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "community_access_links_code_idx" ON "community_access_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "community_access_links_community_idx" ON "community_access_links" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_access_links_active_idx" ON "community_access_links" USING btree ("community_id","is_active");