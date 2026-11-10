"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CONSENT_EVENT, ANALYTICS_CONSENT_KEY,
  retryAnalyticsWithdrawal, setAnalyticsConsent, trackAnalyticsEvent } from "@/lib/analytics";
import styles from "./analytics.module.css";

function readConsent() {
  try { return localStorage.getItem(ANALYTICS_CONSENT_KEY); } catch { return "rejected"; }
}
function subscribeConsent(notify: () => void) {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(ANALYTICS_CONSENT_EVENT, notify); window.removeEventListener("storage", notify); };
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  const [open, setOpen] = useState(false);
  const lastPage = useRef("");

  useEffect(() => {
    void retryAnalyticsWithdrawal();
    window.addEventListener('online', retryAnalyticsWithdrawal);
    function show() { setOpen(true); }
    window.addEventListener("potala:privacy-preferences", show);
    return () => {
      window.removeEventListener('online', retryAnalyticsWithdrawal);
      window.removeEventListener("potala:privacy-preferences", show);
    };
  }, []);

  useEffect(() => { lastPage.current = ""; }, [consent]);

  useEffect(() => {
    if (consent !== "accepted" || lastPage.current === pathname || /^\/(admin|loja|minha-conta)(\/|$)/.test(pathname)) return;
    lastPage.current = pathname;
    trackAnalyticsEvent("page_view");
    const product = pathname.match(/^\/produto\/([0-9a-f-]{36})$/i);
    const activity = pathname.match(/^\/atividades\/([0-9a-f-]{36})$/i);
    if (product) trackAnalyticsEvent("view_item", { productId: product[1] });
    if (activity) trackAnalyticsEvent("view_activity", { activityId: activity[1] });
    if (pathname === "/checkout") trackAnalyticsEvent("begin_checkout");
  }, [pathname, consent]);

  useEffect(() => {
    function contact(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (/^(mailto:|tel:|https:\/\/(wa\.me|api\.whatsapp\.com)\/)/i.test(href)) {
        trackAnalyticsEvent("contact_click");
      }
    }
    document.addEventListener("click", contact);
    return () => document.removeEventListener("click", contact);
  }, []);

  function choose(accepted: boolean) {
    setAnalyticsConsent(accepted);
    setOpen(false);
  }

  if (consent !== null && !open) return null;
  return (
    <section className={styles.notice} aria-label="Preferências de medição" role="region">
      <p>Podemos registrar eventos de navegação para entender o uso do marketplace?
        A medição não inclui nome, e-mail ou dados de pagamento.</p>
      <p>Ao recusar, a coleta neste navegador para. Se estiver offline, a exclusão dos eventos será solicitada quando a conexão voltar.</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose(false)}>Recusar medição</button>
        <button type="button" onClick={() => choose(true)}>Permitir medição</button>
      </div>
    </section>
  );
}

export function PrivacyPreferencesButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("potala:privacy-preferences"))}>
    Preferências de privacidade
  </button>;
}
