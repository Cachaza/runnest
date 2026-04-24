CREATE TABLE "meetup_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meetup_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"meetup_id" integer NOT NULL,
	"community_id" text NOT NULL,
	"author_user_id" text,
	"reply_to_message_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "meetup_messages" ADD CONSTRAINT "meetup_messages_meetup_id_meetups_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meetup_messages" ADD CONSTRAINT "meetup_messages_community_id_communities_organization_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("organization_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meetup_messages" ADD CONSTRAINT "meetup_messages_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meetup_messages" ADD CONSTRAINT "meetup_messages_reply_to_message_id_meetup_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."meetup_messages"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "meetup_messages_meetup_created_at_idx" ON "meetup_messages" USING btree ("meetup_id","created_at");
--> statement-breakpoint
CREATE INDEX "meetup_messages_community_created_at_idx" ON "meetup_messages" USING btree ("community_id","created_at");
