CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'specialist', 'referrer', 'patient');--> statement-breakpoint
CREATE TYPE "public"."specialty" AS ENUM('cardiology', 'dermatology', 'endocrinology', 'gastroenterology', 'neurology', 'oncology', 'orthopedics', 'pediatrics', 'psychiatry', 'radiology', 'general_practice', 'other');--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."member_role";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "specialists" ALTER COLUMN "specialty" SET DATA TYPE "public"."specialty" USING "specialty"::"public"."specialty";