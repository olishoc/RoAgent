export interface Env {
  POLAR_WEBHOOK_SECRET: string;
  POLAR_PRODUCT_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY: string;
  ADMIN_SECRET: string;
}

export type LicenseStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type ActivationLogEvent = "activated" | "validated" | "failed" | "revoked" | "reactivated";

export interface License {
  id: string;
  license_key: string;
  email: string;
  polar_customer_id: string;
  polar_order_id: string;
  status: LicenseStatus;
  machine_id: string | null;
  activated_at: string | null;
  created_at: string;
  last_validated_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  activation_count: number;
  max_activations: number;
}

export interface ActivationLog {
  id: string;
  license_key: string;
  machine_id: string;
  event: ActivationLogEvent;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateLicenseInput {
  email: string;
  polarCustomerId: string;
  polarOrderId: string;
  maxActivations?: number;
}

export interface ActivationResult {
  valid: boolean;
  status?: "ACTIVE";
  activatedAt?: string;
  email?: string;
  error?: "INVALID_KEY" | "LICENSE_REVOKED" | "LICENSE_EXPIRED" | "LICENSE_ALREADY_ACTIVATED";
}

export interface ValidationResult {
  valid: boolean;
  status?: "ACTIVE";
  email?: string;
  lastValidated?: string;
  daysRemaining?: null;
  error?: "INVALID_KEY" | "LICENSE_REVOKED" | "LICENSE_EXPIRED" | "MACHINE_MISMATCH";
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface DbClient {
  from(table: string): DbQuery;
}

export interface DbQuery {
  select(columns?: string): DbQuery;
  insert(values: unknown): DbQuery;
  update(values: unknown): DbQuery;
  eq(column: string, value: unknown): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  maybeSingle<T = unknown>(): Promise<{ data: T | null; error: DbError | null }>;
  single<T = unknown>(): Promise<{ data: T | null; error: DbError | null }>;
  then<TResult1 = { data: unknown; error: DbError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: DbError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

export interface DbError {
  message: string;
  code?: string;
  details?: string;
}

export interface PolarOrderEvent {
  type: string;
  id?: string;
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
    customer_id?: string;
    product_id?: string;
    customer_email?: string;
    metadata?: Record<string, unknown>;
  };
  [key: string]: unknown;
}
