import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hostname, networkInterfaces, platform } from "node:os";
import path from "node:path";
import { AppError } from "../errors.ts";
import type { Config } from "../config.ts";
import { ErrorCode, type LicenseStatus } from "../../../shared/protocol.ts";

const DEFAULT_LICENSE_SERVER_URL = "https://api.studiolink.dev";
const EVALUATION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type LicenseEvent =
  | { type: "warning"; status: LicenseStatus; message: string }
  | { type: "revoked"; status: LicenseStatus; message: string };

export interface LicenseServerResponse {
  valid?: boolean;
  status?: "ACTIVE";
  error?: string;
  activatedAt?: string;
  email?: string;
  lastValidated?: string;
  daysRemaining?: number | null;
  [key: string]: unknown;
}

interface LicenseDiskState {
  licenseKey?: string;
  status: LicenseStatus["status"];
  firstRunAt: string;
  activatedAt?: string;
  expiresAt?: string;
  licenseeEmail?: string;
  plan?: string;
  lastCheckedAt?: string;
  consecutiveFailures?: number;
  validation?: LicenseServerResponse;
}

export interface LicenseManagerOptions {
  fetcher?: typeof fetch;
  now?: () => Date;
  licenseServerUrl?: string;
}

export class LicenseManager {
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly licenseServerUrl: string;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly config: Config, options: LicenseManagerOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.licenseServerUrl = (options.licenseServerUrl ?? config.licenseServerUrl ?? DEFAULT_LICENSE_SERVER_URL).replace(/\/$/, "");
  }

  status(): LicenseStatus {
    const state = this.loadOrCreateState();
    return this.statusFromState(state);
  }

  warning(): LicenseEvent | undefined {
    const status = this.status();
    if (status.status === "ACTIVE") return undefined;
    return { type: "warning", status, message: this.warningMessage(status) };
  }

  async activate(licenseKey: string): Promise<LicenseStatus> {
    const trimmed = licenseKey.trim();
    if (trimmed.length < 8) throw new AppError(ErrorCode.LICENSE_INVALID, "License key is invalid", { details: { reason: "INVALID_KEY" } });
    const machineId = this.machineId();
    const response = await this.callLicenseServer("activate", trimmed, machineId);
    if (!response.valid) throw this.activationError(response.error ?? "INVALID_KEY");

    const now = response.activatedAt ?? this.now().toISOString();
    const state: LicenseDiskState = {
      licenseKey: trimmed,
      status: "ACTIVE",
      firstRunAt: this.loadOrCreateState().firstRunAt,
      activatedAt: now,
      licenseeEmail: response.email,
      plan: "StudioLink",
      lastCheckedAt: now,
      consecutiveFailures: 0,
      validation: response,
    };
    this.writeState(state);
    return this.statusFromState(state);
  }

  async revalidate(): Promise<LicenseEvent | undefined> {
    const state = this.loadOrCreateState();
    if (!state.licenseKey) return this.warning();
    try {
      const response = await this.callLicenseServer("validate", state.licenseKey, this.machineId());
      const error = response.error?.toUpperCase() ?? "";
      if (error === "LICENSE_EXPIRED") {
        const expired: LicenseDiskState = { ...state, status: "EXPIRED", lastCheckedAt: this.now().toISOString(), consecutiveFailures: 0, validation: response };
        this.writeState(expired);
        return { type: "warning", status: this.statusFromState(expired), message: "License is expired" };
      }
      if (error === "LICENSE_REVOKED") {
        const revoked: LicenseDiskState = { ...state, status: "UNLICENSED", lastCheckedAt: this.now().toISOString(), consecutiveFailures: 0, validation: response };
        this.writeState(revoked);
        return { type: "revoked", status: this.statusFromState(revoked), message: "License was revoked or is no longer valid" };
      }
      if (error === "MACHINE_MISMATCH" || error === "INVALID_KEY") {
        const invalid: LicenseDiskState = { ...state, status: "UNLICENSED", lastCheckedAt: this.now().toISOString(), consecutiveFailures: 0, validation: response };
        this.writeState(invalid);
        return { type: "revoked", status: this.statusFromState(invalid), message: error === "MACHINE_MISMATCH" ? "License is active on another machine. Contact support@studiolink.dev to transfer it." : "License is invalid" };
      }
      if (!response.valid) {
        const invalid: LicenseDiskState = { ...state, status: "UNLICENSED", lastCheckedAt: this.now().toISOString(), consecutiveFailures: 0, validation: response };
        this.writeState(invalid);
        return { type: "revoked", status: this.statusFromState(invalid), message: "License was revoked or is no longer valid" };
      }
      const active: LicenseDiskState = {
        ...state,
        status: "ACTIVE",
        licenseeEmail: response.email ?? state.licenseeEmail,
        plan: state.plan ?? "StudioLink",
        lastCheckedAt: response.lastValidated ?? this.now().toISOString(),
        consecutiveFailures: 0,
        validation: response,
      };
      this.writeState(active);
      return undefined;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const failures = (state.consecutiveFailures ?? 0) + 1;
      const next: LicenseDiskState = {
        ...state,
        status: failures >= 3 ? "GRACE" : state.status,
        consecutiveFailures: failures,
        lastCheckedAt: this.now().toISOString(),
      };
      this.writeState(next);
      return failures >= 3 ? { type: "warning", status: this.statusFromState(next), message: "License server is unreachable; StudioLink is running in grace mode" } : undefined;
    }
  }

  startPeriodicRevalidation(onEvent: (event: LicenseEvent) => void, intervalMs = 24 * 60 * 60 * 1000): void {
    this.stopPeriodicRevalidation();
    this.timer = setInterval(() => {
      void this.revalidate().then((event) => {
        if (event) onEvent(event);
      }).catch(() => undefined);
    }, intervalMs);
    this.timer.unref?.();
  }

  stopPeriodicRevalidation(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  machineId(): string {
    const file = path.join(this.config.dataDirectory, "machine.id");
    mkdirSync(path.dirname(file), { recursive: true });
    if (existsSync(file)) {
      const existing = readFileSync(file, "utf8").trim();
      if (existing) return existing;
    }
    const mac = this.primaryMacAddress();
    const id = createHash("sha256").update(`${hostname()}|${mac}|${platform()}`).digest("hex");
    writeFileSync(file, `${id}\n`, { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32") chmodSync(file, 0o600);
    return id;
  }

  private async callLicenseServer(action: "activate" | "validate", licenseKey: string, machineId: string): Promise<LicenseServerResponse> {
    const response = await this.fetcher(`${this.licenseServerUrl}/api/license/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ licenseKey, machineId }),
    });
    const body = await response.json().catch(() => ({})) as LicenseServerResponse;
    if (!response.ok && (response.status >= 500 || response.status === 429)) {
      throw new Error(body.error ?? `License server temporarily unavailable: HTTP_${response.status}`);
    }
    if (!response.ok) return { ...body, valid: false, error: body.error ?? `HTTP_${response.status}` };
    return body;
  }

  private activationError(reason: string): AppError {
    const normalized = reason.toUpperCase();
    if (normalized.includes("ALREADY") || normalized.includes("ACTIVATED")) {
      return new AppError(ErrorCode.LICENSE_ALREADY_ACTIVATED, "License is already activated on another machine", { details: { reason: "LICENSE_ALREADY_ACTIVATED" } });
    }
    if (normalized.includes("EXPIRED")) return new AppError(ErrorCode.LICENSE_EXPIRED, "License key is expired", { details: { reason: "LICENSE_EXPIRED" } });
    if (normalized.includes("REVOKED")) return new AppError(ErrorCode.LICENSE_INVALID, "License key was revoked", { details: { reason: "LICENSE_REVOKED" } });
    if (normalized.includes("MACHINE_MISMATCH")) return new AppError(ErrorCode.LICENSE_INVALID, "License is active on another machine. Contact support@studiolink.dev to transfer it.", { details: { reason: "MACHINE_MISMATCH" } });
    return new AppError(ErrorCode.LICENSE_INVALID, "License key is invalid", { details: { reason: "INVALID_KEY" } });
  }

  private loadOrCreateState(): LicenseDiskState {
    const file = this.licenseFile();
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<LicenseDiskState>;
      return this.normalizeState(parsed);
    }
    const state: LicenseDiskState = { status: "UNLICENSED", firstRunAt: this.now().toISOString(), consecutiveFailures: 0 };
    this.writeState(state);
    return state;
  }

  private normalizeState(parsed: Partial<LicenseDiskState>): LicenseDiskState {
    const legacyStatus = String(parsed.status ?? "UNLICENSED").toLowerCase();
    const status: LicenseDiskState["status"] = legacyStatus === "active"
      ? "ACTIVE"
      : legacyStatus === "expired"
        ? "EXPIRED"
        : parsed.status === "GRACE"
          ? "GRACE"
          : parsed.status === "ACTIVE" || parsed.status === "EXPIRED" || parsed.status === "UNLICENSED"
            ? parsed.status
            : "UNLICENSED";
    return {
      status,
      firstRunAt: parsed.firstRunAt ?? parsed.activatedAt ?? this.now().toISOString(),
      licenseKey: parsed.licenseKey,
      activatedAt: parsed.activatedAt,
      expiresAt: parsed.expiresAt,
      licenseeEmail: parsed.licenseeEmail,
      plan: parsed.plan,
      lastCheckedAt: parsed.lastCheckedAt,
      consecutiveFailures: parsed.consecutiveFailures ?? 0,
      validation: parsed.validation,
    };
  }

  private writeState(state: LicenseDiskState): void {
    const file = this.licenseFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32") chmodSync(file, 0o600);
  }

  private statusFromState(state: LicenseDiskState): LicenseStatus {
    const machineId = this.machineId();
    const daysRemaining = this.daysRemaining(state);
    const status = state.status === "ACTIVE" && state.expiresAt && new Date(state.expiresAt).getTime() <= this.now().getTime()
      ? "EXPIRED"
      : state.status;
    return {
      status,
      daysRemaining,
      activatedAt: state.activatedAt ?? state.firstRunAt,
      machineId,
      expiresAt: state.expiresAt,
      licenseeEmail: state.licenseeEmail,
      plan: state.plan,
      lastCheckedAt: state.lastCheckedAt,
    };
  }

  private daysRemaining(state: LicenseDiskState): number {
    const now = this.now().getTime();
    if (state.status === "ACTIVE" && state.expiresAt) return Math.max(0, Math.ceil((new Date(state.expiresAt).getTime() - now) / DAY_MS));
    if (state.status === "ACTIVE") return 365;
    if (state.status === "EXPIRED") return 0;
    const end = new Date(state.firstRunAt).getTime() + EVALUATION_DAYS * DAY_MS;
    return Math.max(0, Math.ceil((end - now) / DAY_MS));
  }

  private warningMessage(status: LicenseStatus): string {
    if (status.status === "GRACE") return "License validation is temporarily unavailable; StudioLink is running in grace mode";
    if (status.status === "EXPIRED") return "StudioLink license is expired";
    return `StudioLink is in evaluation mode: ${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"} remaining`;
  }

  private licenseFile(): string {
    return path.join(this.config.dataDirectory, "license.json");
  }

  private primaryMacAddress(): string {
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (!entry.internal && entry.mac && entry.mac !== "00:00:00:00:00:00") return entry.mac;
      }
    }
    return "no-mac";
  }
}
