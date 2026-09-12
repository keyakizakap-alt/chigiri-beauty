CREATE TABLE `api_quotas` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`used` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `care_plans` (
	`owner_key` text NOT NULL,
	`day` text NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`owner_key`, `day`)
);
