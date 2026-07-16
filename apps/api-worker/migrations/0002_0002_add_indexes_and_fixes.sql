CREATE INDEX `idx_subscriptions_stripe_id` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_plan_id` ON `subscriptions` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_deleted_at` ON `documents` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_phone_numbers_phone_number` ON `phone_numbers` (`phone_number`);--> statement-breakpoint
CREATE INDEX `idx_users_deleted_at` ON `users` (`deleted_at`);