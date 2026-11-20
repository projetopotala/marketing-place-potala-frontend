import { apiFetch } from "./client";

/**
 * Configurações globais do Marketplace (não financeiras). Dono:
 * catalog-service (`/admin/settings` com @Roles(ADMIN) e `/public/settings`
 * anônimo), roteado pelo potala-api-gateway. Textos `null` significam "não
 * configurado": a vitrine mantém o texto padrão de `data/marketplace.ts`.
 */
export interface PublicMarketplaceSettings {
  announcementEnabled: boolean;
  announcementText: string | null;
  supportEmail: string | null;
  /** E.164 sem "+", ex.: 5511999990000. */
  supportWhatsapp: string | null;
}

export interface AdminMarketplaceSettings extends PublicMarketplaceSettings {
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export type MarketplaceSettingsInput = PublicMarketplaceSettings;

/** Mesmos limites do UpdateSettingsDto do catalog-service. */
export const MAX_ANNOUNCEMENT_TEXT_LENGTH = 140;
export const MAX_SUPPORT_EMAIL_LENGTH = 254;
export const SUPPORT_WHATSAPP_PATTERN = /^55[1-9][0-9]{9,10}$/;

/** GET /admin/settings — sessão ADMIN (cookie HttpOnly). */
export async function getAdminSettings(): Promise<AdminMarketplaceSettings> {
  const result = await apiFetch<AdminMarketplaceSettings>("/admin/settings");
  if (!result) throw new Error("Resposta vazia do servidor.");
  return result;
}

/** PUT /admin/settings — substitui o conjunto completo. */
export async function updateAdminSettings(
  input: MarketplaceSettingsInput,
): Promise<AdminMarketplaceSettings> {
  const result = await apiFetch<AdminMarketplaceSettings>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!result) throw new Error("Resposta vazia do servidor.");
  return result;
}

/**
 * Timeout curto de propósito: esta leitura roda no layout da vitrine. Se o
 * catalog-service estiver lento ou fora, a página não espera por ele — o
 * chamador cai no texto padrão em vez de atrasar ou derrubar a página.
 */
const PUBLIC_SETTINGS_TIMEOUT_MS = 1_500;
const PUBLIC_SETTINGS_REVALIDATE_SECONDS = 60;

/**
 * GET /public/settings — anônimo, server-side. Nunca lança: qualquer falha
 * (rede, 5xx, timeout, resposta malformada) devolve `null`.
 */
export async function getPublicSettings(): Promise<PublicMarketplaceSettings | null> {
  try {
    const result = await apiFetch<PublicMarketplaceSettings>("/public/settings", {
      signal: AbortSignal.timeout(PUBLIC_SETTINGS_TIMEOUT_MS),
      next: { revalidate: PUBLIC_SETTINGS_REVALIDATE_SECONDS },
    });
    if (!result || typeof result.announcementEnabled !== "boolean") return null;
    return result;
  } catch (err) {
    console.warn("[settings] getPublicSettings failed, using storefront defaults:", err);
    return null;
  }
}

/** "5511987654321" -> "(11) 98765-4321"; devolve o valor original se não casar. */
export function formatBrazilWhatsapp(e164: string): string {
  const local = e164.startsWith("55") ? e164.slice(2) : e164;
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}
