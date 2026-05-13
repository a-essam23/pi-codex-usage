# Codex Usage Tracker for pi

Real-time ChatGPT/Codex account usage in your footer. Tracks actual quota from OpenAI's API.

## Features

- **Visual bars** — Configurable characters, colors, length
- **Smart caching** — Auto-adjusts fetch rate based on usage (1-5 min TTL)
- **Cross-session sync** — File-based locking prevents duplicate API calls
- **Account-aware cache** — Avoids showing another logged-in Codex account's snapshot
- **Auto-hide** — Disappears when not using Codex (optional)

## Install

```bash
cp -r codex-usage ~/.pi/agent/extensions/
cd ~/.pi/agent/extensions/codex-usage
cp config.example.ts config.ts
# Edit config.ts, then run /reload or restart pi
```

## Commands

| Command | Description |
|---------|-------------|
| `/codex-usage` | Force refresh, show details |
| `/codex-usage raw` | Force refresh, show raw JSON |
| `/codex-usage hide` | Hide until reload/restart |

## Configuration

Edit `config.ts`:

```typescript
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
  
  // Advanced
  barColorThreshold: 95,  // Color bars above %
  lockFilePath: undefined,// Custom lock file path
};
```

### Presets

| Preset | Style |
|--------|-------|
| `subtle` | Dim until 95% (default) |
| `minimal` | Compact, almost no color |
| `standard` | Color bars at 70% |
| `alert` | Color bars at 50% |
| `compact` | No prefix, short bars |

## How It Works

1. **Local polling** — Reads snapshot every 5s (fast, no network)
2. **Remote fetch** — Calls OpenAI when stale or when you force refresh
3. **Adaptive TTL** — High usage = frequent updates:
   - ≥danger threshold: 1 min
   - ≥warn threshold: 2 min
   - ≥normal threshold: 3 min
   - Low usage: 5 min

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Not logged in" | Run `/login openai-codex` |
| Changes not showing | Run `/reload`; if still stale, full restart: `/quit` then `pi` |
| Footer missing | Check `/codex-usage hide`, run `/reload`, or confirm model provider is `openai-codex` |
| Reset cache | `rm ~/.pi/agent/usage/codex-account-usage.json` |

## Files

| File | Purpose |
|------|---------|
| `config.ts` | Your settings (gitignored) |
| `config.example.ts` | Template with presets |
| `types.ts` | Type definitions |
| `~/.pi/agent/usage/codex-account-usage.json` | Latest snapshot |
| `~/.pi/agent/usage/codex-account-usage.jsonl` | History (if enabled) |
