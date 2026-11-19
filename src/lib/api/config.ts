/** Browser requests use the site origin so session cookies are first-party. */
export const API_BASE_URL = typeof window === "undefined"
  ? (process.env.API_UPSTREAM_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1")
  : "/api/v1";
