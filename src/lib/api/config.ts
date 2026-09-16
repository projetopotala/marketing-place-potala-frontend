/**
 * Base URL of potala-api-gateway's public API (`/api/v1`), the single entry
 * point every service now sits behind (see the architecture analysis and
 * status docs in the Claude project for this migration). Every request the
 * frontend makes to any backend service goes through here.
 *
 * `NEXT_PUBLIC_` is required because this value is read from client
 * components (AuthContext runs in the browser) — Next.js only inlines
 * `NEXT_PUBLIC_*` variables into the client bundle at build time. The
 * default matches the gateway's own default port (see
 * potala-api-gateway/.env.example, PORT=8080) for local development without
 * any extra setup.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";
