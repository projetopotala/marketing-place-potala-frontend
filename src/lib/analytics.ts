import { API_BASE_URL } from "@/lib/api/config";

export const ANALYTICS_CONSENT_KEY = "potala-analytics-consent-v1";
const SESSION_KEY = "potala-analytics-session-v1";
export const ANALYTICS_CONSENT_EVENT = "potala:analytics-consent";
export type AnalyticsEvent = "page_view" | "view_item" | "add_to_cart" | "begin_checkout" |
  "sign_up" | "seller_application" | "contact_click" | "view_activity" | "enroll" | "download";
const pending = new Set<AbortController>();
const WITHDRAW_KEY = 'potala-analytics-withdraw-v1';

export async function retryAnalyticsWithdrawal() {
  try {
    const sessions: string[] = JSON.parse(localStorage.getItem(WITHDRAW_KEY) ?? '[]');
    for (const sessionId of sessions) {
      const response = await fetch(`${API_BASE_URL}/public/analytics/withdraw`, {
        method: 'POST', credentials: 'omit', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const remaining: string[] = JSON.parse(localStorage.getItem(WITHDRAW_KEY) ?? '[]');
      localStorage.setItem(WITHDRAW_KEY, JSON.stringify(remaining.filter(id => id !== sessionId)));
    }
  } catch { /* Offline withdrawals remain queued for the next visit. */ }
}

export function getAnalyticsContext(): { analyticsConsent: boolean; analyticsSessionId?: string } {
  if (typeof window === "undefined") return { analyticsConsent: false };
  try {
    if (localStorage.getItem(ANALYTICS_CONSENT_KEY) !== "accepted") return { analyticsConsent: false };
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return { analyticsConsent: true, analyticsSessionId: sessionId };
  } catch {
    return { analyticsConsent: false };
  }
}

export function setAnalyticsConsent(accepted: boolean) {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, accepted ? "accepted" : "rejected");
    if (!accepted) {
      const previousSession = sessionStorage.getItem(SESSION_KEY);
      if (previousSession) {
        const sessions: string[] = JSON.parse(localStorage.getItem(WITHDRAW_KEY) ?? '[]');
        localStorage.setItem(WITHDRAW_KEY, JSON.stringify([...new Set([...sessions, previousSession])]));
      }
      sessionStorage.removeItem(SESSION_KEY);
      for (const controller of pending) controller.abort();
      pending.clear();
      void retryAnalyticsWithdrawal();
    }
  } catch { /* Storage blocked: optional analytics remains disabled. */ }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

export function trackAnalyticsEvent(event: AnalyticsEvent, details: {
  productId?: string; activityId?: string; quantity?: number;
} = {}) {
  const context = getAnalyticsContext();
  if (!context.analyticsConsent || !context.analyticsSessionId) return;
  const controller = new AbortController();
  pending.add(controller);
  const timeout = setTimeout(() => controller.abort(), 5000);
  void fetch(`${API_BASE_URL}/public/analytics/events`, {
    method: "POST", credentials: "omit", keepalive: true,
    headers: { "content-type": "application/json" }, signal: controller.signal,
    body: JSON.stringify({ id: crypto.randomUUID(), sessionId: context.analyticsSessionId,
      consent: true, event, ...details }),
  }).catch(() => { /* Telemetry must not interrupt shopping. */ }).finally(() => {
    clearTimeout(timeout);
    pending.delete(controller);
  });
}
