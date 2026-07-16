ALTER TABLE `documents` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `tenant_id` text NOT NULL REFERENCES tenants(id);--> statement-breakpoint
CREATE INDEX `idx_messages_tenant_id` ON `messages` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` integer;