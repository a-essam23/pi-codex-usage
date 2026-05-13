/**
 * Visual/style presets for Codex Usage Tracker.
 */

import { defaultConfig } from "./constants.js";
import type { Config } from "./types.js";

/** Subtle: only show color when actually dangerous */
export const subtle: Config = {
	...defaultConfig,
};

/** Minimal: almost no color ever, compact */
export const minimal: Config = {
	...defaultConfig,
	enableHistory: false,
	barColorThreshold: 101, // never color bars
	barColorHigh: "dim",
	barFilled: "·",
	barEmpty: " ",
	barLength: 8,
	prefix: "C",
	showSecondary: false,
	showPercentages: false,
	thresholds: {
		primary: { danger: 99, warn: 95, normal: 90 },
		secondary: { danger: 99, warn: 98 },
	},
};

/** Standard: color bars earlier, and show even on non-Codex models */
export const standard: Config = {
	...defaultConfig,
	disableIfNotCodex: false,
	barColorThreshold: 70,
	barColorHigh: "warning",
	thresholds: {
		primary: { danger: 90, warn: 70, normal: 50 },
		secondary: { danger: 90, warn: 70 },
	},
};

/** Alert: color everything aggressively */
export const alert: Config = {
	...defaultConfig,
	barColorThreshold: 50,
	barColorHigh: "warning",
	thresholds: {
		primary: { danger: 80, warn: 50, normal: 30 },
		secondary: { danger: 80, warn: 50 },
	},
};

/** Compact: minimal info, small bars */
export const compact: Config = {
	...defaultConfig,
	enableHistory: false,
	barFilled: "▪",
	barEmpty: "▫",
	barLength: 5,
	prefix: "",
	showSecondary: false,
	showReset: false,
};
