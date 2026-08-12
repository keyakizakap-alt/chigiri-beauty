CREATE TABLE `chat_sessions` (
	`owner_key` text NOT NULL,
	`id` text NOT NULL,
	`specialist_id` text NOT NULL,
	`title` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_key`, `id`)
);
--> statement-breakpoint
CREATE INDEX `chat_sessions_owner_specialist_updated_idx` ON `chat_sessions` (`owner_key`,`specialist_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `deleted_chat_sessions` (
	`owner_key` text NOT NULL,
	`id` text NOT NULL,
	`deleted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_key`, `id`)
);
