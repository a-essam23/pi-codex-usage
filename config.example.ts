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

import { defaultConfig } from "./constants.js";
import { subtle } from "./presets.js";
import type { Config } from "./types.js";

export { defaultConfig };
export { alert, compact, minimal, standard, subtle } from "./presets.js";
export type { Config, ThemeColor } from "./types.js";

/**
 * ACTIVE CONFIGURATION
 * Change this object to use a different preset or define your own.
 */
export const config: Config = {
	...subtle,
	prefix: "CODEX",
	barFilled: "█",
	barEmpty: "░",
	barLength: 10,
	showSecondary: true,
	showPercentages: true,
	showReset: true,

	// Cache/fetch defaults are inherited from the preset.
	// Override cacheTtlMs or lockStaleMs here if you want different timings.
};

/**
 * Example: fully custom config
 * Uncomment below and comment out the `export const config` above.
 */
// export const config: Config = {
//   ...defaultConfig,
//   pollIntervalMs: 5_000,
//   lockStaleMs: 30_000,
//   cacheTtlMs: {
//     danger: 60_000,
//     warn: 120_000,
//     normal: 180_000,
//     low: 300_000,
//   },
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
