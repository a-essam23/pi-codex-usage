// Personal configuration - gitignored
// Copy from config.example.ts and modify, or import and extend

import { subtle } from "./presets.js";
import type { Config } from "./types.js";

// Your custom config extending the subtle preset
export const config: Config = {
	...subtle,
	prefix: "CODEX",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	showSecondary: true,
	showPercentages: true,
	showReset: true,
	// Options inherited from subtle via spread, but can override:
	// disableIfNotCodex: true,  // Hide when not using Codex model
	// enableHistory: true,      // Keep JSONL history for debugging
	// lockFilePath: undefined,  // Custom lock file path
	// lockStaleMs: 30_000,      // Treat abandoned lock files as stale after this
	// cacheTtlMs: {             // Cache freshness TTLs by usage level
	// 	danger: 60_000,
	// 	warn: 120_000,
	// 	normal: 180_000,
	// 	low: 300_000,
	// },
};
