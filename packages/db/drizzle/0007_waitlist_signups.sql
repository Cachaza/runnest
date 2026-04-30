CREATE TABLE IF NOT EXISTS "waitlist_signups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "waitlist_signups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"source" text DEFAULT 'landing' NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"marketing_consent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_signups_email_idx" ON "waitlist_signups" USING btree ("email");
