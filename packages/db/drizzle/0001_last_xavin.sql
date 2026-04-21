CREATE TABLE "community_user_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"invited_user_id" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_user_invites" ADD CONSTRAINT "community_user_invites_community_id_communities_organization_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_user_invites" ADD CONSTRAINT "community_user_invites_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_user_invites" ADD CONSTRAINT "community_user_invites_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_user_invites_community_invited_user_idx" ON "community_user_invites" USING btree ("community_id","invited_user_id");--> statement-breakpoint
CREATE INDEX "community_user_invites_invited_user_status_idx" ON "community_user_invites" USING btree ("invited_user_id","status");--> statement-breakpoint
CREATE INDEX "community_user_invites_status_idx" ON "community_user_invites" USING btree ("status");