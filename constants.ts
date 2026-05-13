/**
 * Shared constants and default configuration values for Codex Usage Tracker.
 */

import type { Config } from "./types.js";

export const CODEX_PROVIDER = "openai-codex";
export const CODEX_RESPONSES_API = "openai-codex-responses";
export const CODEX_USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
export const STATUS_KEY = "codex-usage";

export const USAGE_DIR_NAME = "usage";
export const SNAPSHOT_FILE_NAME = "codex-account-usage.json";
export const HISTORY_FILE_NAME = "codex-account-usage.jsonl";
export const LOCK_FILE_NAME = "codex-account-usage.lock";

export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const DEFAULT_LOCK_STALE_MS = 30_000;

export const DEFAULT_CACHE_TTL_MS = {
	danger: 60_000,
	warn: 120_000,
	normal: 180_000,
	low: 300_000,
} as const;

export const DEFAULT_THRESHOLDS = {
	primary: { danger: 95, warn: 90, normal: 70 },
	secondary: { danger: 98, warn: 95 },
} as const;

export const defaultConfig: Config = {
	pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
	lockStaleMs: DEFAULT_LOCK_STALE_MS,
	cacheTtlMs: { ...DEFAULT_CACHE_TTL_MS },
	disableIfNotCodex: true,
	enableHistory: true,
	barColorThreshold: 95,
	barColorHigh: "error",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	prefix: "Codex",
	showSecondary: true,
	showPercentages: true,
	showReset: true,
	thresholds: {
		primary: { ...DEFAULT_THRESHOLDS.primary },
		secondary: { ...DEFAULT_THRESHOLDS.secondary },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};
