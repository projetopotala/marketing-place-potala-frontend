/** Real session backed by identity-service, resolved through potala-api-gateway. */

export type UserRole = "customer" | "seller" | "admin";

/** Minimum password length identity-service's own DTOs enforce (RegisterCustomerDto/RegisterSellerDto — MinLength(8)). Kept here so the form's own pre-check matches the backend instead of guessing a different number. */
export const MIN_PASSWORD_LENGTH = 8;

export interface Session {
  userId: string;
  email: string;
  /** Falls back to the email's local part when no profile name is set — see buildSession in lib/api/auth.ts. */
  name: string;
  role: UserRole;
  /**
   * Only present for role "seller", and only once resolved — sellerId lives
   * in sellers-service, not identity-service (separate schema, separate
   * service), so it is fetched via a second call
   * (GET /seller/onboarding/status) right after the session is established.
   * A seller session with no sellerId means that lookup hasn't completed
   * yet or failed — SellerAuthGuard already treats a missing sellerId as
   * "not a valid seller session", same as before this integration.
   */
  sellerId?: string;
}

export type AccessMode = "login" | "register";
