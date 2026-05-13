# Codex Usage Tracker for pi

Real-time ChatGPT/Codex account usage in your footer. Tracks actual quota from OpenAI's API.

## Features

- **Visual bars** — Configurable characters, colors, length
- **Smart caching** — Auto-adjusts fetch rate based on usage with configurable TTLs
- **Cross-session sync** — Extension-local file cache and locking prevent duplicate API calls
- **Account-aware cache** — Avoids showing another logged-in Codex account's snapshot
- **Auto-hide** — Disappears when not using Codex (optional)

## Install

### Pi package

```bash
pi install git:github.com/a-essam23/pi-codex-usage
```

### Manual install

```bash
cp -r codex-usage ~/.pi/agent/extensions/
cd ~/.pi/agent/extensions/codex-usage
# Edit config.ts, then run /reload or restart pi
```

## Commands

| Command | Description |
|---------|-------------|
| `/codex-usage` | Force refresh, show details |
| `/codex-usage raw` | Force refresh, show raw JSON |
| `/codex-usage hide` | Hide until reload/restart |

## Configuration

**Config file location:**
```
~/.pi/agent/git/github.com/a-essam23/pi-codex-usage/config.ts
```

Edit `config.ts`:

```typescript
import { subtle } from "./presets.js";
import type { Config } from "./types.js";

export const config: Config = {
  ...subtle,              // Start from preset
  prefix: "CODEX",        // "Codex", "C", or ""
  barFilled: "█",
  barEmpty: "░",
  barLength: 10,
  
  // Toggles
  showSecondary: true,    // 7d window
  showPercentages: true,  // "88%"
  showReset: true,        // "↻2h5m"
  disableIfNotCodex: true,// Hide for non-Codex models
  enableHistory: true,    // Keep usage history JSONL
  
  // Cache/fetch behavior
  pollIntervalMs: 5_000,  // Local file polling only, no network
  lockStaleMs: 30_000,    // Treat abandoned lock files as stale
  cacheTtlMs: {
    danger: 60_000,       // Primary >= danger threshold, limit reached, or disallowed
    warn: 120_000,        // Primary >= warn threshold
    normal: 180_000,      // Primary >= normal threshold
    low: 300_000,         // Primary below normal threshold
  },

  // Advanced
  barColorThreshold: 95,  // Color bars above %
  lockFilePath: undefined,// Custom lock file path
};
```

### Presets

| Preset | Style | Best for |
|--------|-------|----------|
| `subtle` | Dim until 95% (default) | Clean, distraction-free |
| `minimal` | Compact, almost no color | Screen space saving |
| `standard` | Color bars at 70% | Early warning |
| `alert` | Color bars at 50% | Aggressive monitoring |
| `compact` | No prefix, short bars | Minimal footprint |

**Switch presets:**
```typescript
import { minimal } from "./presets.js";  // Change this

export const config: Config = {
  ...minimal,  // And this
};
```

## How It Works

1. **Local polling** — Reads `usage/codex-account-usage.json` every 5s (fast, no network)
2. **Event-driven refresh** — On session start, model change, and Codex turn end, it checks whether the cached snapshot is still fresh
3. **Remote fetch** — Calls OpenAI only when the snapshot is missing, stale, force-refreshed, or a limit/rate/quota error is detected
4. **Adaptive TTL** — Freshness is based on snapshot age, current usage, and `config.cacheTtlMs`:
   - ≥danger threshold: fresh for `cacheTtlMs.danger` (default 1 min)
   - ≥warn threshold: fresh for `cacheTtlMs.warn` (default 2 min)
   - ≥normal threshold: fresh for `cacheTtlMs.normal` (default 3 min)
   - Low usage: fresh for `cacheTtlMs.low` (default 5 min)

Freshness check:

```typescript
isFresh = Date.now() - new Date(snapshot.fetchedAt).getTime() < refreshTtlMs(snapshot)
```

So the extension listens at every Codex turn end, but most turns only read the local cache file and do **not** call OpenAI.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Not logged in" | Run `/login openai-codex` |
| Changes not showing | Run `/reload`; if still stale, full restart: `/quit` then `pi` |
| Footer missing | Check `/codex-usage hide`, run `/reload`, or confirm model provider is `openai-codex` |
| Reset cache | `rm ~/.pi/agent/extensions/codex-usage/usage/codex-account-usage.json` |

## Files

## Visual Customization Guide

### Bar Characters

Common choices for `barFilled` / `barEmpty`:

| Style | Filled | Empty | Length suggestion |
|-------|--------|-------|-------------------|
| Blocks (default) | `█` | `░` | 10 |
| Dense | `▓` | `░` | 12-16 |
| Dots | `▪` | `▫` | 8-10 |
| Dots 2 | `·` | ` ` | 8 |
| Terminal | `\|` | `-` or `·` | 10-15 |
| Arrows | `→` | `·` | 10 |

### Colors

Valid theme colors: `dim`, `success`, `warning`, `error`

```typescript
colors: {
  prefix: "success",   // "CODEX" label color
  bars: "dim",         // Default bar color
  barsHigh: "error",   // Bar color when above threshold
  labels: "warning",   // "5h", "7d" labels
  text: "dim",         // Percentage numbers
  reset: "success",    // "↻2h5m" reset timer
}
```

### Custom Example

```typescript
import type { Config } from "./types.js";

export const config: Config = {
  // Start from scratch or extend a preset
  prefix: "⚡",
  barFilled: "▓",
  barEmpty: "░",
  barLength: 12,
  barColorThreshold: 70,
  
  showSecondary: true,
  showPercentages: true,
  showReset: true,
  
  colors: {
    prefix: "warning",
    bars: "dim",
    barsHigh: "error",
    labels: "dim",
    text: "dim",
    reset: "success",
  },
  
  // Thresholds affect caching speed
  thresholds: {
    primary: { danger: 90, warn: 75, normal: 50 },
    secondary: { danger: 95, warn: 80 },
  },
};
```

## Files

| File | Purpose | Location |
|------|---------|----------|
| `config.ts` | **Your settings (gitignored)** | `~/.pi/agent/git/github.com/a-essam23/pi-codex-usage/config.ts` |
| `config.example.ts` | Template config | Same directory |
| `constants.ts` | Default values | Same directory |
| `presets.ts` | Built-in presets (`subtle`, `minimal`, etc.) | Same directory |
| `types.ts` | TypeScript definitions | Same directory |
| `usage/codex-account-usage.json` | Latest snapshot cache | `~/.pi/agent/extensions/codex-usage/usage/` |
| `usage/codex-account-usage.jsonl` | History (if enabled) | Same directory |
| `usage/codex-account-usage.lock` | Cross-session lock | Same directory |
