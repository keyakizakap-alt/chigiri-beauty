CREATE TABLE `uploaded_assets` (
	`owner_key` text NOT NULL,
	`id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_key`, `id`)
);
--> statement-breakpoint
CREATE INDEX `uploaded_assets_owner_created_idx` ON `uploaded_assets` (`owner_key`,`created_at`);