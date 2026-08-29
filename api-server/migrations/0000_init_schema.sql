CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" text NOT NULL,
	"target_id" integer,
	"requester_id" integer NOT NULL,
	"amount" numeric,
	"before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" integer,
	"reviewed_at" timestamp,
	"review_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"operator_id" integer,
	"amount" numeric NOT NULL,
	"balance_after" numeric NOT NULL,
	"vault_balance_after" numeric,
	"type" text NOT NULL,
	"note" text,
	"request_id" text,
	"room_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"client_action_id" text NOT NULL,
	"action_version" integer DEFAULT 0 NOT NULL,
	"response_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" text NOT NULL,
	"config_value" jsonb NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "config_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" text NOT NULL,
	"config_value" jsonb NOT NULL,
	"changed_by" integer,
	"change_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cs_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cs_id" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"satisfaction" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cs_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_role" text NOT NULL,
	"receiver_id" integer NOT NULL,
	"receiver_role" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"related_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"name" text NOT NULL,
	"platform" text,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"trusted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"level" text NOT NULL,
	"flow" numeric DEFAULT 0 NOT NULL,
	"commission_rate" numeric DEFAULT 0 NOT NULL,
	"commission_amount" numeric DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "econ_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" text DEFAULT 'global' NOT NULL,
	"room_level" text DEFAULT 'all' NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"default_value" jsonb NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"input_type" text DEFAULT 'text' NOT NULL,
	"options" jsonb,
	"min_value" integer,
	"max_value" integer,
	"step" integer DEFAULT 1 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "econ_config_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" text DEFAULT 'global' NOT NULL,
	"room_level" text DEFAULT 'all' NOT NULL,
	"config_key" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"reason" text,
	"operator_id" integer NOT NULL,
	"operator_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer,
	"player_id" integer,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_request_id" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_economy_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" text NOT NULL,
	"game_name" text NOT NULL,
	"rake_mode" text DEFAULT 'percentage' NOT NULL,
	"rake_rate" numeric DEFAULT 0.03 NOT NULL,
	"rake_cap" numeric DEFAULT 0 NOT NULL,
	"rake_base_type" text DEFAULT 'pot' NOT NULL,
	"rake_base_desc" text DEFAULT '' NOT NULL,
	"min_rake_pot" numeric DEFAULT 0 NOT NULL,
	"agent_rebate_rate" numeric DEFAULT 0.01 NOT NULL,
	"top_agent_rebate_rate" numeric DEFAULT 0.01 NOT NULL,
	"platform_rate" numeric DEFAULT 0.01 NOT NULL,
	"rebate_cap_enabled" boolean DEFAULT false NOT NULL,
	"rebate_cap" numeric DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_economy_config_game_type_unique" UNIQUE("game_type")
);
--> statement-breakpoint
CREATE TABLE "game_economy_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"reason" text,
	"operator_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"room_no" text,
	"round_no" integer NOT NULL,
	"game_type" text NOT NULL,
	"result" jsonb NOT NULL,
	"winner_user_id" integer,
	"pot_before_rake" numeric DEFAULT 0 NOT NULL,
	"rake" numeric DEFAULT 0 NOT NULL,
	"turnover" numeric DEFAULT 0 NOT NULL,
	"result_is_summary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hand_states" (
	"room_id" integer PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip" text,
	"device" text,
	"platform" text,
	"user_agent" text,
	"success" boolean NOT NULL,
	"fail_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tag_type" text NOT NULL,
	"tag_value" text NOT NULL,
	"reason" text,
	"created_by" integer,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_anomalies" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"anomaly_type" text NOT NULL,
	"description" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer
);
--> statement-breakpoint
CREATE TABLE "room_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer,
	"room_no" text NOT NULL,
	"agent_id" integer NOT NULL,
	"game_type" text NOT NULL,
	"level" text DEFAULT 'junior' NOT NULL,
	"total_rounds" integer DEFAULT 0 NOT NULL,
	"total_rake" numeric DEFAULT 0 NOT NULL,
	"total_flow" numeric DEFAULT 0 NOT NULL,
	"agent_net_cost" numeric,
	"platform_income" numeric,
	"end_reason" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_invite_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"token" text NOT NULL,
	"used_by_user_id" integer,
	"expires_at" timestamp NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "room_invite_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "room_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"target_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"seat" integer NOT NULL,
	"points" numeric NOT NULL,
	"is_spectator" boolean DEFAULT false NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"auto_play" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_template_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"template_code" text NOT NULL,
	"min_buy_in" numeric DEFAULT 100 NOT NULL,
	"max_buy_in" numeric DEFAULT 1000 NOT NULL,
	"chip_denomination" numeric DEFAULT 1 NOT NULL,
	"max_bet_per_round" numeric DEFAULT 0 NOT NULL,
	"chips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cap" integer DEFAULT 0 NOT NULL,
	"base_bet" integer DEFAULT 0 NOT NULL,
	"game_type" text NOT NULL,
	"default_rounds" integer DEFAULT 25 NOT NULL,
	"max_seats" integer DEFAULT 8 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "room_template_config_template_code_unique" UNIQUE("template_code")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_no" text NOT NULL,
	"password" text NOT NULL,
	"game_type" text NOT NULL,
	"level" text NOT NULL,
	"initial_points" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"total_rounds" integer DEFAULT 25 NOT NULL,
	"max_seats" integer DEFAULT 8 NOT NULL,
	"total_rake" numeric DEFAULT 0 NOT NULL,
	"total_flow" numeric DEFAULT 0 NOT NULL,
	"fixed_ante" numeric DEFAULT 0 NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_room_no_unique" UNIQUE("room_no")
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"feature_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"password" text NOT NULL,
	"security_code" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"nickname" text,
	"avatar" text DEFAULT '1' NOT NULL,
	"signature" text,
	"settings" jsonb,
	"last_login_at" timestamp,
	"invite_code" text NOT NULL,
	"invited_by_code" text,
	"invited_by_id" integer,
	"points" numeric DEFAULT 0 NOT NULL,
	"vault_points" numeric DEFAULT 0 NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"cs_status" text DEFAULT 'offline' NOT NULL,
	"deleted_at" timestamp,
	"risk_level" text DEFAULT 'normal' NOT NULL,
	"freeze_reason" text,
	"freeze_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_account_unique" UNIQUE("account"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_drafts" ADD CONSTRAINT "config_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_history" ADD CONSTRAINT "config_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs_conversations" ADD CONSTRAINT "cs_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs_conversations" ADD CONSTRAINT "cs_conversations_cs_id_users_id_fk" FOREIGN KEY ("cs_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_tags" ADD CONSTRAINT "risk_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_tags" ADD CONSTRAINT "risk_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_anomalies" ADD CONSTRAINT "room_anomalies_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_anomalies" ADD CONSTRAINT "room_anomalies_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_history" ADD CONSTRAINT "room_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;