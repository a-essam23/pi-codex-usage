/**
 * Type definitions for Codex Usage Tracker
 */

import type { ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type UsageWindow = {
	used_percent?: number;
	limit_window_seconds?: number;
	reset_after_seconds?: number;
	reset_at?: number;
};

export type CodexAccountUsage = {
	user_id?: string;
	account_id?: string;
	email?: string;
	plan_type?: string;
	rate_limit?: {
		allowed?: boolean;
		limit_reached?: boolean;
		primary_window?: UsageWindow;
		secondary_window?: UsageWindow;
	};
	code_review_rate_limit?: unknown;
	additional_rate_limits?: unknown;
	credits?: {
		has_credits?: boolean;
		unlimited?: boolean;
		overage_limit_reached?: boolean;
		balance?: string;
		approx_local_messages?: number[];
		approx_cloud_messages?: number[];
	};
	spend_control?: {
		reached?: boolean;
		individual_limit?: unknown;
	};
	rate_limit_reached_type?: string | null;
	promo?: unknown;
	referral_beacon?: unknown;
};

export type SanitizedUsage = Omit<CodexAccountUsage, "user_id" | "account_id" | "email">;

// ============================================================================
// SNAPSHOT TYPES
// ============================================================================

export type UsageSnapshot = {
	version: 1;
	fetchedAt: string;
	account: string;
	source: string;
	usage: SanitizedUsage;
};

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

/** State of the data fetching layer */
export type DataState =
	| { kind: "no-data" }
	| { kind: "fresh"; snapshot: UsageSnapshot }
	| { kind: "stale"; snapshot: UsageSnapshot }
	| { kind: "fetching" }
	| { kind: "error"; error: string; fallback?: UsageSnapshot };

/** State of the UI visibility layer */
export type VisibilityState =
	| { kind: "hidden-user" } // User used /codex-usage hide
	| { kind: "hidden-wrong-model"; currentProvider?: string } // Not Codex
	| { kind: "visible" }; // Should show if we have data

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface Config {
	/** How often to poll the local snapshot file (milliseconds) */
	pollIntervalMs: number;

	/** If true, completely hide the status when not using a Codex model */
	disableIfNotCodex: boolean;

	/** If true, enable the JSONL history file (for debugging/trends) */
	enableHistory: boolean;

	/** Custom lock file path (default: ~/.pi/agent/usage/codex.lock) */
	lockFilePath?: string;

	/**
	 * When to color the bars vs keep them dim.
	 * Set to 101 to never color bars (since max is 100).
	 */
	barColorThreshold: number;

	/** Bar color when above threshold */
	barColorHigh: ThemeColor;

	/** Bar characters */
	barFilled: string;  // e.g., "█", "▪", "|", "#"
	barEmpty: string;   // e.g., "░", "▫", "·", " ", "-"

	/** How many characters wide the bar is */
	barLength: number;  // e.g., 5, 10, 20

	/** Text before the bars (e.g., "Codex", "C", "CDX") */
	prefix: string;

	/** Whether to show the secondary (7d) window */
	showSecondary: boolean;

	/** Whether to show percentage numbers (e.g., "97%") */
	showPercentages: boolean;

	/** Whether to show the reset timer (e.g., "↻2h5m") */
	showReset: boolean;

	/**
	 * Thresholds for TTL (time-to-live) of cached data.
	 * Determines how often to re-fetch from OpenAI.
	 * - danger: high usage, fetch frequently
	 * - warn: medium usage, moderate fetch rate
	 * - normal: low usage, fetch rarely
	 */
	thresholds: {
		primary: { danger: number; warn: number; normal: number };
		secondary: { danger: number; warn: number };
	};

	/** Color for each visual element */
	colors: {
		/** Prefix: "Codex" */
		prefix: ThemeColor;
		/** Bar characters */
		bars: ThemeColor;
		/** Bar characters when above threshold (overrides barColorHigh if set, or uses barColorHigh) */
		barsHigh?: ThemeColor;
		/** Window labels: "5h", "7d" */
		labels: ThemeColor;
		/** Percentage numbers: "97%" */
		text: ThemeColor;
		/** Reset indicator: "↻2h5m" */
		reset: ThemeColor;
	};
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type { ExtensionContext, ThemeColor };
