/**
 * Codex Usage Visual Configuration - EXAMPLE/TEMPLATE
 *
 * This is the example/template file. Copy this to `config.ts` and customize.
 *
 * Setup:
 *   cp config.example.ts config.ts
 *
 * Then edit `config.ts` with your personal settings. `config.ts` is gitignored.
 *
 * Changes take effect after `/reload` (or full restart if cached).
 */

import type { Config } from "./types.js";
export type { Config, ThemeColor } from "./types.js";

/** Subtle: only show color when actually dangerous */
export const subtle: Config = {
	pollIntervalMs: 5_000,
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
		primary: { danger: 95, warn: 90, normal: 70 },
		secondary: { danger: 98, warn: 95 },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};

/** Minimal: almost no color ever, compact */
export const minimal: Config = {
	pollIntervalMs: 5_000,
	disableIfNotCodex: true,
	enableHistory: false,
	barColorThreshold: 101, // never color bars
	barColorHigh: "dim",
	barFilled: "·",
	barEmpty: " ",
	barLength: 8,
	prefix: "C",
	showSecondary: false,
	showPercentages: false,
	showReset: true,
	thresholds: {
		primary: { danger: 99, warn: 95, normal: 90 },
		secondary: { danger: 99, warn: 98 },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};

/** Standard: traffic light colors */
export const standard: Config = {
	pollIntervalMs: 5_000,
	disableIfNotCodex: false, // show even if not codex
	enableHistory: true,
	barColorThreshold: 70,
	barColorHigh: "warning",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	prefix: "Codex",
	showSecondary: true,
	showPercentages: true,
	showReset: true,
	thresholds: {
		primary: { danger: 90, warn: 70, normal: 50 },
		secondary: { danger: 90, warn: 70 },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};

/** Alert: color everything aggressively */
export const alert: Config = {
	pollIntervalMs: 5_000,
	disableIfNotCodex: true,
	enableHistory: true,
	barColorThreshold: 50,
	barColorHigh: "warning",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	prefix: "Codex",
	showSecondary: true,
	showPercentages: true,
	showReset: true,
	thresholds: {
		primary: { danger: 80, warn: 50, normal: 30 },
		secondary: { danger: 80, warn: 50 },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};

/** Compact: minimal info, small bars */
export const compact: Config = {
	pollIntervalMs: 5_000,
	disableIfNotCodex: true,
	enableHistory: false,
	barColorThreshold: 95,
	barColorHigh: "error",
	barFilled: "▪",
	barEmpty: "▫",
	barLength: 5,
	prefix: "",
	showSecondary: false,
	showPercentages: true,
	showReset: false,
	thresholds: {
		primary: { danger: 95, warn: 90, normal: 70 },
		secondary: { danger: 98, warn: 95 },
	},
	colors: {
		prefix: "dim",
		bars: "dim",
		labels: "dim",
		text: "dim",
		reset: "dim",
	},
};

/**
 * ACTIVE CONFIGURATION
 * Change this line to use a different preset or define your own.
 */
// Using a custom config based on subtle, but with CODEX uppercase
export const config: Config = {
	...subtle,
	prefix: "CODEX",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	showSecondary: true,
	showPercentages: true,
	showReset: true,
};

/**
 * Example: fully custom config
 * Uncomment below and comment out `export const config = subtle;` above.
 */
// export const config: Config = {
//   pollIntervalMs: 5_000,
//   disableIfNotCodex: true,
//   enableHistory: true,
//   barColorThreshold: 90,
//   barColorHigh: "error",
//   barFilled: "#",
//   barEmpty: "-",
//   barLength: 15,
//   prefix: "CDX",
//   showSecondary: true,
//   showPercentages: true,
//   showReset: true,
//   thresholds: {
//     primary: { danger: 95, warn: 85, normal: 70 },
//     secondary: { danger: 95, warn: 90 },
//   },
//   colors: {
//     prefix: "dim",
//     bars: "dim",
//     labels: "dim",
//     text: "dim",
//     reset: "dim",
//   },
// };
