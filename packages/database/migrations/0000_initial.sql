CREATE TABLE IF NOT EXISTS `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
	`owner_id` text,
	`settings` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`clerk_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text NOT NULL DEFAULT 'member',
	`status` text NOT NULL DEFAULT 'active',
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_tenant_id` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL DEFAULT '{}',
	`status` text NOT NULL DEFAULT 'draft',
	`version` integer NOT NULL DEFAULT 1,
	`published_version` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agents_tenant_id` ON `agents` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agents_status` ON `agents` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `knowledge_bases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config` text NOT NULL DEFAULT '{}',
	`document_count` integer NOT NULL DEFAULT 0,
	`chunk_count` integer NOT NULL DEFAULT 0,
	`total_size_bytes` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'active',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_knowledge_bases_tenant_id` ON `knowledge_bases` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`knowledge_base_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`source` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'queued',
	`processing_error` text,
	`chunk_count` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_documents_knowledge_base_id` ON `documents` (`knowledge_base_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_documents_tenant_id` ON `documents` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_documents_status` ON `documents` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`knowledge_base_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`index` integer NOT NULL,
	`content` text NOT NULL,
	`token_count` integer NOT NULL,
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chunks_document_id` ON `chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chunks_knowledge_base_id` ON `chunks` (`knowledge_base_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chunks_tenant_id` ON `chunks` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`session_id` text,
	`channel` text NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
	`summary` text,
	`message_count` integer NOT NULL DEFAULT 0,
	`total_tokens` integer NOT NULL DEFAULT 0,
	`total_cost_usd` real NOT NULL DEFAULT 0,
	`metadata` text NOT NULL DEFAULT '{}',
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_conversations_tenant_id` ON `conversations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_conversations_agent_id` ON `conversations` (`agent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_conversations_status` ON `conversations` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_conversations_created_at` ON `conversations` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`session_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`type` text NOT NULL DEFAULT 'text',
	`metadata` text NOT NULL DEFAULT '{}',
	`tool_calls` text NOT NULL DEFAULT '[]',
	`tool_call_id` text,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`total_tokens` integer DEFAULT 0,
	`estimated_cost_usd` real DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_conversation_id` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_messages_created_at` ON `messages` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL DEFAULT 'created',
	`metadata` text NOT NULL DEFAULT '{}',
	`state` text NOT NULL DEFAULT '{}',
	`voice_state` text,
	`phone_state` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_tenant_id` ON `sessions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_agent_id` ON `sessions` (`agent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_conversation_id` ON `sessions` (`conversation_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL DEFAULT '{}',
	`status` text NOT NULL DEFAULT 'active',
	`domains` text NOT NULL DEFAULT '[]',
	`signed_secret` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_widgets_tenant_id` ON `widgets` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_widgets_agent_id` ON `widgets` (`agent_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `phone_numbers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text,
	`provider` text NOT NULL DEFAULT 'twilio',
	`phone_number` text NOT NULL,
	`friendly_name` text,
	`capabilities` text NOT NULL DEFAULT '{}',
	`status` text NOT NULL DEFAULT 'available',
	`provider_reference` text,
	`monthly_cost` real NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_phone_numbers_tenant_id` ON `phone_numbers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_phone_numbers_agent_id` ON `phone_numbers` (`agent_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`phone_number_id` text NOT NULL,
	`agent_id` text,
	`direction` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`status` text NOT NULL DEFAULT 'initiated',
	`duration` integer NOT NULL DEFAULT 0,
	`recording_url` text,
	`cost` integer NOT NULL DEFAULT 0,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`phone_number_id`) REFERENCES `phone_numbers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calls_tenant_id` ON `calls` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calls_phone_number_id` ON `calls` (`phone_number_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calls_status` ON `calls` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_calls_created_at` ON `calls` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`type` text NOT NULL DEFAULT 'usage',
	`status` text NOT NULL DEFAULT 'active',
	`pricing` text NOT NULL DEFAULT '{}',
	`limits` text NOT NULL DEFAULT '{}',
	`stripe_product_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `plans_slug_unique` ON `plans` (`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`status` text NOT NULL DEFAULT 'trialing',
	`current_period_start` integer NOT NULL,
	`current_period_end` integer NOT NULL,
	`trial_end` integer,
	`cancel_at_period_end` integer NOT NULL DEFAULT 0,
	`canceled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscriptions_tenant_id` ON `subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscriptions_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subscription_id` text,
	`stripe_invoice_id` text,
	`number` text NOT NULL,
	`status` text NOT NULL DEFAULT 'draft',
	`amount_due` real NOT NULL DEFAULT 0,
	`amount_paid` real NOT NULL DEFAULT 0,
	`currency` text NOT NULL DEFAULT 'USD',
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`due_date` integer,
	`paid_at` integer,
	`hosted_invoice_url` text,
	`line_items` text NOT NULL DEFAULT '[]',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invoices_tenant_id` ON `invoices` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`permissions` text NOT NULL DEFAULT '[]',
	`last_used_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_keys_tenant_id` ON `api_keys` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_keys_key_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`old_values` text,
	`new_values` text,
	`ip_address` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_tenant_id` ON `audit_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_resource` ON `audit_logs` (`resource`,`resource_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text,
	`conversation_id` text,
	`event` text NOT NULL,
	`provider` text,
	`quantity` real NOT NULL DEFAULT 0,
	`cost` real NOT NULL DEFAULT 0,
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_records_tenant_id` ON `usage_records` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_records_agent_id` ON `usage_records` (`agent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_records_created_at` ON `usage_records` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`agent_id` text,
	`conversation_id` text,
	`event` text NOT NULL,
	`channel` text,
	`metadata` text NOT NULL DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_analytics_events_tenant_id` ON `analytics_events` (`tenant_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_analytics_events_agent_id` ON `analytics_events` (`agent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_analytics_events_created_at` ON `analytics_events` (`created_at`);
