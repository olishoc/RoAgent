CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  polar_customer_id TEXT NOT NULL,
  polar_order_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  machine_id TEXT NULL,
  activated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoke_reason TEXT NULL,
  activation_count INTEGER NOT NULL DEFAULT 0,
  max_activations INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS activation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL REFERENCES licenses(license_key),
  machine_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('activated','validated','failed','revoked','reactivated')),
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  polar_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_polar_order_id ON licenses(polar_order_id);
CREATE INDEX IF NOT EXISTS idx_activation_log_license_created ON activation_log(license_key, created_at);
