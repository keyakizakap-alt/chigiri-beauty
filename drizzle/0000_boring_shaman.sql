CREATE TABLE `consultations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concern_summary` text NOT NULL,
	`selected_product_ids_json` text DEFAULT '[]' NOT NULL,
	`purchase_needed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`volume` text,
	`price` integer,
	`price_type` text NOT NULL,
	`currency` text DEFAULT 'JPY' NOT NULL,
	`claims_json` text DEFAULT '[]' NOT NULL,
	`ingredient_highlights_json` text DEFAULT '[]' NOT NULL,
	`official_url` text NOT NULL,
	`source_publisher` text NOT NULL,
	`source_checked_at` text NOT NULL,
	`verification_status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
