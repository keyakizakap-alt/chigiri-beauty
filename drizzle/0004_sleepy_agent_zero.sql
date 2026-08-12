CREATE TABLE `owned_items` (
	`owner_key` text NOT NULL,
	`id` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_key`, `id`)
);
--> statement-breakpoint
CREATE INDEX `owned_items_owner_updated_idx` ON `owned_items` (`owner_key`,`updated_at`);