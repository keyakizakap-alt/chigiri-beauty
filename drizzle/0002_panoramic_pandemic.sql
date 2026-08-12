CREATE TABLE `beauty_check_ins` (
	`owner_key` text NOT NULL,
	`id` text NOT NULL,
	`specialist_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_key`, `id`)
);
--> statement-breakpoint
CREATE INDEX `beauty_check_ins_owner_specialist_recorded_idx` ON `beauty_check_ins` (`owner_key`,`specialist_id`,`recorded_at`);