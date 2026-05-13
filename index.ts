/**
 * OpenAI Codex Account Usage
 *
 * Queries ChatGPT's Codex usage endpoint with a global cache/lock so multiple
 * pi sessions share one usage snapshot and avoid spamming the endpoint.
 *
 * Configuration: edit config.ts in this directory, then /reload.
 *
 * Commands:
 *   /codex-usage        force refresh and show account usage
 *   /codex-usage raw    force refresh and show raw JSON
 *   /codex-usage hide   hide the footer status until reload/restart
 */

import { createHash } from "node:crypto";
import {
	appendFileSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "./config.js";
import {
	CODEX_PROVIDER,
	CODEX_RESPONSES_API,
	CODEX_USAGE_ENDPOINT,
	HISTORY_FILE_NAME,
	LOCK_FILE_NAME,
	SNAPSHOT_FILE_NAME,
	STATUS_KEY,
	USAGE_DIR_NAME,
} from "./constants.js";
import type { ExtensionContext, UsageSnapshot, CodexAccountUsage, SanitizedUsage, DataState, VisibilityState, UsageWindow } from "./types.js";

// ============================================================================
// STATE
// ============================================================================

class UsageTracker {
	private dataState: DataState = { kind: "no-data" };
	private visibilityState: VisibilityState = { kind: "visible" };
	private currentCtx: ExtensionContext | undefined;
	private pollTimer: ReturnType<typeof setInterval> | undefined;
	private pollRefreshInFlight = false;
	private lastPollRefreshAttemptAt = 0;

	// Start the extension
	start(pi: ExtensionAPI): void {
		this.registerEventHandlers(pi);
	}

	// Event registration
	private registerEventHandlers(pi: ExtensionAPI): void {
		pi.on("session_start", async (_event, ctx) => {
			this.currentCtx = ctx;
			this.checkModelAndUpdate(ctx);
			this.startPolling();
			// Initial background fetch, but don't poll OpenAI while hidden for non-Codex models.
			if (this.visibilityState.kind === "visible") {
				await this.maybeRefresh(ctx, { allowStale: true });
			}
		});

		pi.on("session_shutdown", async () => {
			this.stopPolling();
			this.currentCtx = undefined;
		});

		pi.on("model_select", async (_event, ctx) => {
			this.currentCtx = ctx;
			this.checkModelAndUpdate(ctx);
			if (this.visibilityState.kind === "visible") {
				await this.maybeRefresh(ctx, { allowStale: true });
			}
		});

		pi.on("message_end", async (event, ctx) => {
			if (!this.isCodexMessage(event.message)) return;
			this.currentCtx = ctx;
			const force = this.isLimitError(event.message);
			await this.maybeRefresh(ctx, { force, allowStale: true });
		});

		pi.registerCommand("codex-usage", {
			description: "Show ChatGPT/Codex account usage from the remote usage endpoint",
			handler: async (args, ctx) => {
				await this.handleCommand(args, ctx);
			},
		});
	}

	// Check current model and update visibility state
	private checkModelAndUpdate(ctx: ExtensionContext): void {
		const isCodex = ctx.model?.provider === CODEX_PROVIDER;
		const wasVisible = this.visibilityState.kind === "visible";

		if (this.visibilityState.kind === "hidden-user") {
			// User explicitly hid it - respect that
			this.render(ctx);
			return;
		}

		if (config.disableIfNotCodex && !isCodex) {
			this.visibilityState = {
				kind: "hidden-wrong-model",
				currentProvider: ctx.model?.provider,
			};
		} else {
			this.visibilityState = { kind: "visible" };
		}

		const isVisible = this.visibilityState.kind === "visible";
		if (wasVisible !== isVisible || this.dataState.kind !== "no-data") {
			this.render(ctx);
		}
	}

	// Poll for snapshot updates (from other processes)
	private startPolling(): void {
		this.stopPolling();
		this.pollTimer = setInterval(() => {
			const ctx = this.currentCtx;
			if (!ctx) return;

			const snapshot = readSnapshotForContext(ctx);
			if (snapshot) {
				this.setSnapshotState(snapshot);
			} else if (this.dataState.kind !== "fetching") {
				this.dataState = { kind: "no-data" };
			}
			this.render(ctx);

			// If a reset boundary passed while pi was idle, refresh automatically so
			// the footer doesn't keep showing the pre-reset 100% snapshot forever.
			if (snapshot && this.visibilityState.kind === "visible" && !isFresh(snapshot)) {
				void this.refreshFromPolling(ctx);
			}
		}, config.pollIntervalMs);
	}

	private async refreshFromPolling(ctx: ExtensionContext): Promise<void> {
		if (this.pollRefreshInFlight) return;

		// Avoid retrying every local poll if the network/auth endpoint is failing.
		const minRetryMs = Math.max(config.pollIntervalMs, config.cacheTtlMs.danger);
		if (Date.now() - this.lastPollRefreshAttemptAt < minRetryMs) return;

		this.pollRefreshInFlight = true;
		this.lastPollRefreshAttemptAt = Date.now();
		try {
			await this.maybeRefresh(ctx, { allowStale: true });
		} finally {
			this.pollRefreshInFlight = false;
		}
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = undefined;
		}
	}

	// Decide whether to fetch based on data state
	private async maybeRefresh(
		ctx: ExtensionContext,
		opts: { force?: boolean; allowStale?: boolean } = {},
	): Promise<void> {
		const snapshot = readSnapshotForContext(ctx);

		if (snapshot && !opts.force && isFresh(snapshot)) {
			this.setSnapshotState(snapshot);
			this.render(ctx);
			return;
		}

		if (snapshot && opts.allowStale) {
			// Show existing data while the refresh happens in the background.
			this.dataState = { kind: "stale", snapshot };
			this.render(ctx);
		}

		// Try to acquire lock and fetch. Stale snapshots still refresh.
		await this.fetchWithLock(ctx, { force: opts.force });
	}

	private setSnapshotState(snapshot: UsageSnapshot): void {
		this.dataState = isFresh(snapshot)
			? { kind: "fresh", snapshot }
			: { kind: "stale", snapshot };
	}

	private setErrorState(error: unknown, ctx: ExtensionContext): void {
		const fallback = readSnapshotForContext(ctx);
		this.dataState = {
			kind: "error",
			error: error instanceof Error ? error.message : String(error),
			fallback: fallback || undefined,
		};
	}

	private async fetchRemoteAndStore(ctx: ExtensionContext): Promise<CodexAccountUsage> {
		const raw = await fetchCodexAccountUsage(ctx);
		const snapshot = buildSnapshot(ctx, raw);
		writeSnapshot(snapshot);
		this.dataState = { kind: "fresh", snapshot };
		return raw;
	}

	// Fetch with global file lock
	private async fetchWithLock(ctx: ExtensionContext, opts: { force?: boolean } = {}): Promise<void> {
		const lock = acquireLock();
		if (lock === undefined) {
			// Another process is fetching - wait and read result
			await sleep(1000);
			const latest = readSnapshotForContext(ctx);
			if (latest) {
				this.setSnapshotState(latest);
				this.render(ctx);
			}
			return;
		}

		// We have the lock - must release it in all paths
		try {
			// Double-check after acquiring lock. Forced refresh bypasses cache freshness.
			const latest = readSnapshotForContext(ctx);
			if (!opts.force && latest && isFresh(latest)) {
				this.setSnapshotState(latest);
				this.render(ctx);
				return;
			}

			this.dataState = { kind: "fetching" };
			this.render(ctx);

			await this.fetchRemoteAndStore(ctx);
		} catch (error) {
			this.setErrorState(error, ctx);
		} finally {
			releaseLock(lock);
			this.render(ctx);
		}
	}

	// Render based on current states
	private render(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		// Determine what to show based on visibility state
		switch (this.visibilityState.kind) {
			case "hidden-user":
			case "hidden-wrong-model": {
				ctx.ui.setStatus(STATUS_KEY, undefined);
				return;
			}
			case "visible": {
				// Show based on data state
				switch (this.dataState.kind) {
					case "no-data":
						ctx.ui.setStatus(STATUS_KEY, undefined);
						return;
					case "fresh":
					case "stale": {
						const status = formatStatus(this.dataState.snapshot, ctx);
						ctx.ui.setStatus(STATUS_KEY, status);
						return;
					}
					case "fetching": {
						// Keep showing previous state while fetching (don't clear)
						return;
					}
					case "error": {
						// On error, show fallback if available, otherwise clear
						if (this.dataState.fallback) {
							const status = formatStatus(this.dataState.fallback, ctx);
							ctx.ui.setStatus(STATUS_KEY, status);
						} else {
							ctx.ui.setStatus(STATUS_KEY, undefined);
						}
						return;
					}
				}
			}
		}
	}

	// Command handler
	private async handleCommand(args: string, ctx: ExtensionContext): Promise<void> {
		const command = args.trim();

		if (command === "hide") {
			this.visibilityState = { kind: "hidden-user" };
			ctx.ui.setStatus(STATUS_KEY, undefined);
			ctx.ui.notify("Codex usage footer status hidden.", "info");
			return;
		}

		if (command && command !== "raw") {
			ctx.ui.notify("Usage: /codex-usage [raw|hide]", "warning");
			return;
		}

		try {
			ctx.ui.notify("Fetching ChatGPT/Codex account usage...", "info");
			this.visibilityState = { kind: "visible" };

			if (command === "raw") {
				const raw = await this.forceFetchRawWithLock(ctx);
				ctx.ui.notify(JSON.stringify(raw, null, 2), "info");
				return;
			}

			await this.fetchWithLock(ctx, { force: true });

			if (this.dataState.kind === "error") {
				throw new Error(this.dataState.error);
			}

			if (this.dataState.kind === "fresh" || this.dataState.kind === "stale") {
				ctx.ui.notify(formatAccountUsage(this.dataState.snapshot), "info");
			} else {
				ctx.ui.notify("No usage data available.", "warning");
			}
		} catch (error) {
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		}
	}

	// Helpers
	private async forceFetchRawWithLock(ctx: ExtensionContext): Promise<CodexAccountUsage> {
		const lock = acquireLock();
		if (lock === undefined) {
			throw new Error("Another pi session is already fetching Codex usage. Try again in a moment.");
		}

		try {
			this.dataState = { kind: "fetching" };
			this.render(ctx);
			return await this.fetchRemoteAndStore(ctx);
		} catch (error) {
			this.setErrorState(error, ctx);
			throw error;
		} finally {
			releaseLock(lock);
			this.render(ctx);
		}
	}

	private isCodexMessage(message: unknown): message is AssistantMessage {
		const msg = message as Partial<AssistantMessage> | undefined;
		return msg?.role === "assistant" && (msg.provider === CODEX_PROVIDER || msg.api === CODEX_RESPONSES_API);
	}

	private isLimitError(message: AssistantMessage): boolean {
		return message.stopReason === "error" && /usage limit|usage_limit|rate limit|rate_limit|quota|429/i.test(message.errorMessage ?? "");
	}
}

// ============================================================================
// PURE FUNCTIONS (no side effects, easily testable)
// ============================================================================

function getExtensionDir(): string {
	return __dirname;
}

function getUsageDir(): string {
	return join(getExtensionDir(), USAGE_DIR_NAME);
}

function getSnapshotFile(): string {
	return join(getUsageDir(), SNAPSHOT_FILE_NAME);
}

function getHistoryFile(): string {
	return join(getUsageDir(), HISTORY_FILE_NAME);
}

function getLockFile(): string {
	return config.lockFilePath || join(getUsageDir(), LOCK_FILE_NAME);
}

function ensureUsageDir(): void {
	mkdirSync(getUsageDir(), { recursive: true });
}

function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function getAccountKey(ctx: ExtensionContext, raw?: CodexAccountUsage): string {
	const credential = ctx.modelRegistry.authStorage.get(CODEX_PROVIDER)

	// Prefer the credential account id because it is the same value we can read
	// before fetching. The usage endpoint's account_id can be a different internal
	// id, which would make our own freshly-written snapshot fail the account check.
	if (credential?.type === "oauth" && typeof credential.accountId === "string") {
		return `acct_${shortHash(credential.accountId)}`;
	}
	if (raw?.account_id) return `acct_${shortHash(raw.account_id)}`;
	return "unknown-account";
}

function sanitizeUsage(usage: CodexAccountUsage): SanitizedUsage {
	const { user_id: _userId, account_id: _accountId, email: _email, ...rest } = usage;
	return rest;
}

function buildSnapshot(ctx: ExtensionContext, raw: CodexAccountUsage): UsageSnapshot {
	return {
		version: 1,
		fetchedAt: new Date().toISOString(),
		account: getAccountKey(ctx, raw),
		source: CODEX_USAGE_ENDPOINT,
		usage: sanitizeUsage(raw),
	};
}

function readSnapshot(): UsageSnapshot | undefined {
	const file = getSnapshotFile();
	if (!existsSync(file)) return undefined;
	try {
		return JSON.parse(readFileSync(file, "utf8")) as UsageSnapshot;
	} catch {
		return undefined;
	}
}

function readSnapshotForContext(ctx: ExtensionContext): UsageSnapshot | undefined {
	const snapshot = readSnapshot();
	if (!snapshot) return undefined;

	const account = getAccountKey(ctx);
	if (account !== "unknown-account" && snapshot.account !== account) {
		return undefined;
	}

	return snapshot;
}

function writeSnapshot(snapshot: UsageSnapshot): void {
	ensureUsageDir();
	const file = getSnapshotFile();
	const tempFile = `${file}.${process.pid}.tmp`;
	const text = `${JSON.stringify(snapshot, null, 2)}\n`;
	writeFileSync(tempFile, text, "utf8");
	renameSync(tempFile, file);
	if (config.enableHistory) {
		appendFileSync(getHistoryFile(), `${JSON.stringify(snapshot)}\n`, "utf8");
	}
}

function acquireLock(): number | undefined {
	ensureUsageDir();
	const lockFile = getLockFile();
	try {
		return openSync(lockFile, "wx");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code !== "EEXIST") throw error;
		try {
			const stat = statSync(lockFile);
			if (Date.now() - stat.mtimeMs > config.lockStaleMs) {
				unlinkSync(lockFile);
				return openSync(lockFile, "wx");
			}
		} catch {
			// Race condition - treat as locked
		}
		return undefined;
	}
}

function releaseLock(fd: number): void {
	try {
		closeSync(fd);
	} catch {
		// ignore
	}
	try {
		unlinkSync(getLockFile());
	} catch {
		// ignore
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(seconds: number | undefined): string {
	if (seconds === undefined || !Number.isFinite(seconds)) return "unknown";
	const minutes = Math.max(0, Math.round(seconds / 60));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	if (hours < 48) return remMinutes ? `${hours}h${remMinutes}m` : `${hours}h`;
	const days = Math.floor(hours / 24);
	const remHours = hours % 24;
	return remHours ? `${days}d${remHours}h` : `${days}d`;
}

function windowLabel(window?: UsageWindow): string {
	const seconds = window?.limit_window_seconds;
	if (!seconds || !Number.isFinite(seconds)) return "?";
	if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
	if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
	return formatDuration(seconds);
}

function currentResetAfterSeconds(window?: UsageWindow, fetchedAt?: string): number | undefined {
	if (window?.reset_at) return Math.max(0, Math.round(window.reset_at - Date.now() / 1000));
	if (window?.reset_after_seconds === undefined) return undefined;
	if (!fetchedAt) return window.reset_after_seconds;

	const fetchedAtSeconds = new Date(fetchedAt).getTime() / 1000;
	if (!Number.isFinite(fetchedAtSeconds)) return window.reset_after_seconds;
	return Math.max(0, Math.round(fetchedAtSeconds + window.reset_after_seconds - Date.now() / 1000));
}

function hasWindowReset(window: UsageWindow | undefined, fetchedAt: string): boolean {
	return currentResetAfterSeconds(window, fetchedAt) === 0;
}

function hasAnyUsageWindowReset(snapshot: UsageSnapshot): boolean {
	const rate = snapshot.usage.rate_limit;
	return hasWindowReset(rate?.primary_window, snapshot.fetchedAt) || hasWindowReset(rate?.secondary_window, snapshot.fetchedAt);
}

function formatWindowLine(label: string, window?: UsageWindow): string {
	if (!window) return `${label}: unavailable`;
	const used = window.used_percent ?? 0;
	const resetIn = formatDuration(currentResetAfterSeconds(window));
	const size = windowLabel(window);
	const resetAt = window.reset_at ? new Date(window.reset_at * 1000).toLocaleString() : "unknown";
	return `${label} (${size}): ${used}% used, resets in ${resetIn} at ${resetAt}`;
}

function refreshTtlMs(snapshot?: UsageSnapshot): number {
	const usage = snapshot?.usage;
	if (!usage) return 0;
	const rate = usage.rate_limit;
	const primary = rate?.primary_window?.used_percent ?? 0;
	// Use config thresholds for dynamic TTL
	if (rate?.allowed === false || rate?.limit_reached || primary >= config.thresholds.primary.danger) {
		return config.cacheTtlMs.danger;
	}
	if (primary >= config.thresholds.primary.warn) {
		return config.cacheTtlMs.warn;
	}
	if (primary >= config.thresholds.primary.normal) {
		return config.cacheTtlMs.normal;
	}
	return config.cacheTtlMs.low;
}

function snapshotAgeMs(snapshot?: UsageSnapshot): number {
	if (!snapshot) return Number.POSITIVE_INFINITY;
	return Date.now() - new Date(snapshot.fetchedAt).getTime();
}

function isFresh(snapshot?: UsageSnapshot): boolean {
	if (!snapshot) return false;
	if (hasAnyUsageWindowReset(snapshot)) return false;
	return snapshotAgeMs(snapshot) < refreshTtlMs(snapshot);
}

async function fetchCodexAccountUsage(ctx: ExtensionContext): Promise<CodexAccountUsage> {
	const token = await ctx.modelRegistry.getApiKeyForProvider(CODEX_PROVIDER);
	if (!token) throw new Error("Not logged into OpenAI Codex. Run /login openai-codex first.");

	const credential = ctx.modelRegistry.authStorage.get(CODEX_PROVIDER) as
		| { type?: string; accountId?: unknown }
		| undefined;

	const headers: Record<string, string> = {
		Accept: "application/json",
		Authorization: `Bearer ${token}`,
		"OAI-Language": "en-US",
		Referer: "https://chatgpt.com/codex/cloud/settings/analytics",
		"X-OpenAI-Target-Path": "/backend-api/wham/usage",
		"X-OpenAI-Target-Route": "/backend-api/wham/usage",
		originator: "pi",
	};

	if (credential?.type === "oauth" && typeof credential.accountId === "string") {
		headers["chatgpt-account-id"] = credential.accountId;
	}

	const response = await fetch(CODEX_USAGE_ENDPOINT, { headers, signal: ctx.signal });
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`Codex usage request failed (${response.status}): ${text || response.statusText}`);
	}
	return JSON.parse(text);
}

function formatAccountUsage(snapshot: UsageSnapshot): string {
	const usage = snapshot.usage;
	const lines = ["ChatGPT/Codex account usage"];
	if (usage.plan_type) lines.push(`Plan: ${usage.plan_type}`);
	if (usage.rate_limit) {
		lines.push(`Allowed now: ${usage.rate_limit.allowed === false ? "no" : "yes"}`);
		lines.push(`Limit reached: ${usage.rate_limit.limit_reached ? "yes" : "no"}`);
		lines.push(formatWindowLine("Primary", usage.rate_limit.primary_window));
		lines.push(formatWindowLine("Secondary", usage.rate_limit.secondary_window));
	}
	if (usage.credits) {
		const local = usage.credits.approx_local_messages?.join("/") ?? "unknown";
		const cloud = usage.credits.approx_cloud_messages?.join("/") ?? "unknown";
		lines.push(
			`Credits: balance ${usage.credits.balance ?? "unknown"}, has credits ${usage.credits.has_credits ? "yes" : "no"}, unlimited ${usage.credits.unlimited ? "yes" : "no"}`,
		);
		lines.push(`Approx messages: local ${local}, cloud ${cloud}`);
	}
	if (usage.spend_control) lines.push(`Spend control reached: ${usage.spend_control.reached ? "yes" : "no"}`);
	if (usage.rate_limit_reached_type) lines.push(`Reached type: ${usage.rate_limit_reached_type}`);
	lines.push(`Fetched: ${new Date(snapshot.fetchedAt).toLocaleString()}`);
	return lines.join("\n");
}

function usageBar(percent: number | undefined, theme: ExtensionContext["ui"]["theme"]): string {
	const value = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
	const filled = Math.round((value / 100) * config.barLength);
	const empty = config.barLength - filled;
	const raw = `${config.barFilled.repeat(filled)}${config.barEmpty.repeat(empty)}`;

	if (value >= config.barColorThreshold) {
		const highColor = config.colors.barsHigh ?? config.barColorHigh;
		return theme.fg(highColor, raw);
	}
	return theme.fg(config.colors.bars, raw);
}

function formatStatus(snapshot: UsageSnapshot, ctx: ExtensionContext): string {
	const usage = snapshot.usage;
	const rate = usage.rate_limit;
	const primary = rate?.primary_window;
	const p = Math.round(primary?.used_percent ?? 0);
	const reset = formatDuration(currentResetAfterSeconds(primary, snapshot.fetchedAt));

	const pBar = usageBar(p, ctx.ui.theme);

	// Build parts conditionally based on config
	const parts: string[] = [];

	// Prefix (e.g., "Codex")
	if (config.prefix) {
		parts.push(ctx.ui.theme.fg(config.colors.prefix, config.prefix));
	}

	// Primary window: label + bar + percentage
	parts.push(ctx.ui.theme.fg(config.colors.labels, windowLabel(primary)));
	parts.push(pBar);
	if (config.showPercentages) {
		parts.push(ctx.ui.theme.fg(config.colors.text, `${p}%`));
	}

	// Secondary window (7d): only compute if shown
	if (config.showSecondary) {
		const secondary = rate?.secondary_window;
		const s = Math.round(secondary?.used_percent ?? 0);
		const sBar = usageBar(s, ctx.ui.theme);
		parts.push(ctx.ui.theme.fg(config.colors.labels, windowLabel(secondary)));
		parts.push(sBar);
		if (config.showPercentages) {
			parts.push(ctx.ui.theme.fg(config.colors.text, `${s}%`));
		}
	}

	// Reset timer
	if (config.showReset) {
		parts.push(ctx.ui.theme.fg(config.colors.reset, `↻${reset}`));
	}

	return parts.join(" ");
}

// ============================================================================
// EXPORT
// ============================================================================

export default function codexUsageExtension(pi: ExtensionAPI) {
	const tracker = new UsageTracker();
	tracker.start(pi);
}
