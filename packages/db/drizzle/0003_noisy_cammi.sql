CREATE TABLE "community_join_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_community_id_communities_organization_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_join_requests" ADD CONSTRAINT "community_join_requests_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_join_requests_community_status_idx" ON "community_join_requests" USING btree ("community_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "community_join_requests_community_user_idx" ON "community_join_requests" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_join_requests_user_status_idx" ON "community_join_requests" USING btree ("user_id","status");