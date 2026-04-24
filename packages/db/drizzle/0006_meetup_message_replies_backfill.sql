ALTER TABLE "meetup_messages" ADD COLUMN IF NOT EXISTS "reply_to_message_id" integer;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'meetup_messages_reply_to_message_id_meetup_messages_id_fk'
	) THEN
		ALTER TABLE "meetup_messages"
			ADD CONSTRAINT "meetup_messages_reply_to_message_id_meetup_messages_id_fk"
			FOREIGN KEY ("reply_to_message_id")
			REFERENCES "public"."meetup_messages"("id")
			ON DELETE set null
			ON UPDATE no action;
	END IF;
END $$;
