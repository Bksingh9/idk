CREATE TYPE "public"."experience_level" AS ENUM('new', 'casual', 'experienced', 'pro');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('invited', 'accepted', 'declined', 'completed');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('free', 'indie', 'studio');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('developer', 'tester');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"tester_id" uuid NOT NULL,
	"bugs_found" text,
	"fun_rating" integer NOT NULL,
	"where_did_you_drop_off" text,
	"would_you_pay" boolean,
	"general_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_fun_rating_range" CHECK ("feedback"."fun_rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"display_name" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan" "plan_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"plan_current_period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"developer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"platform" text NOT NULL,
	"build_url" text,
	"build_file_path" text,
	"target_genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"target_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"feedback_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "project_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"developer_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_feedback_id_unique" UNIQUE("feedback_id"),
	CONSTRAINT "ratings_stars_range" CHECK ("ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "test_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"tester_id" uuid NOT NULL,
	"status" "invite_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tester_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"platforms" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"experience_level" "experience_level" DEFAULT 'new' NOT NULL,
	"reputation_score" integer DEFAULT 0 NOT NULL,
	"tests_completed" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_tester_id_profiles_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_developer_id_profiles_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_developer_id_profiles_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_invites" ADD CONSTRAINT "test_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_invites" ADD CONSTRAINT "test_invites_tester_id_profiles_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tester_profiles" ADD CONSTRAINT "tester_profiles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feedback_project_tester" ON "feedback" USING btree ("project_id","tester_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_project" ON "feedback" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_projects_developer" ON "projects" USING btree ("developer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_invite_project_tester" ON "test_invites" USING btree ("project_id","tester_id");--> statement-breakpoint
CREATE INDEX "idx_invites_tester" ON "test_invites" USING btree ("tester_id","status");