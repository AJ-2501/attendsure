import { randomBytes } from "node:crypto";

// Provide fake crypto keys for tests so modules don't crash on missing env vars.
// Real Supabase calls are never made in unit tests.
const fakeKey24b = randomBytes(24).toString("base64");
const fakeKey32b = randomBytes(32).toString("base64");

process.env.TDES_ENCRYPTION_KEY ??= fakeKey24b;
process.env.TDES_MAC_KEY ??= fakeKey32b;
process.env.STUDENT_ID_LOOKUP_KEY ??= fakeKey32b;
process.env.QR_TOKEN_SECRET ??= fakeKey32b;
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
