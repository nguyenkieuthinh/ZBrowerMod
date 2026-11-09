CREATE TABLE `channel_text` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`language` text,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`code_hash`) REFERENCES `channels`(`code_hash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `channel_text_expiry_idx` ON `channel_text` (`expires_at`);--> statement-breakpoint
CREATE TABLE `channels` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channels_last_activity_idx` ON `channels` (`last_activity_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer NOT NULL
);
