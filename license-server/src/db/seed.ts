import { createClient } from "@supabase/supabase-js";
import { randomLicenseKey } from "../services/licenseService.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running seed");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const rows = [
  { license_key: randomLicenseKey(), email: "active-unactivated@example.com", polar_customer_id: "seed_customer_1", polar_order_id: `seed_order_${Date.now()}_1`, status: "ACTIVE" },
  { license_key: randomLicenseKey(), email: "active-activated@example.com", polar_customer_id: "seed_customer_2", polar_order_id: `seed_order_${Date.now()}_2`, status: "ACTIVE", machine_id: "seed-machine", activated_at: new Date().toISOString(), activation_count: 1 },
  { license_key: randomLicenseKey(), email: "revoked@example.com", polar_customer_id: "seed_customer_3", polar_order_id: `seed_order_${Date.now()}_3`, status: "REVOKED", revoked_at: new Date().toISOString(), revoke_reason: "seed revoked" },
];

const { data, error } = await supabase.from("licenses").insert(rows).select("*");
if (error) throw error;
console.log("Seeded test licenses:");
for (const row of data ?? []) console.log(`${row.status}: ${row.license_key} (${row.email})`);
