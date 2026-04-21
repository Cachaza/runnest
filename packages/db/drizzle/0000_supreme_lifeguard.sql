CREATE TABLE "crews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "crews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"city" text NOT NULL,
	"pace" text NOT NULL,
	"vibe" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meetups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"crew_id" integer NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"distance_km" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"city" text NOT NULL,
	"pace" text NOT NULL,
	"bio" text,
	"availability" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crews_city_idx" ON "crews" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "crews_name_idx" ON "crews" USING btree ("name");--> statement-breakpoint
CREATE INDEX "meetups_crew_id_starts_at_idx" ON "meetups" USING btree ("crew_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");