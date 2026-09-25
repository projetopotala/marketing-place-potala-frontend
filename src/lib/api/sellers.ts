import { apiFetch } from "./client";
import type { AdminSellerDocumentType, AdminSellerStatus } from "./admin";

/**
 * Client novo pra tela "Configurações" do vendedor, contra
 * GET/PATCH /seller/settings (sellers-service, criado nesta sessão — ver
 * status-migracao-microservicos.md no Claude Project). Reaproveita
 * AdminSellerStatus/AdminSellerDocumentType de admin.ts (mesmos enums do
 * Prisma, sellers-service) em vez de redeclarar.
 *
 * Rota já cai sob o mount amplo '/api/v1/seller' (sellers-service) no
 * gateway — nenhuma rota nova precisou ser adicionada em proxy-routes.ts.
 */

export interface MySellerSettings {
  id: string;
  legalName: string;
  tradeName: string;
  slug: string;
  documentType: AdminSellerDocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  description: string | null;
  status: AdminSellerStatus;
  commissionBps: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function getMySellerSettings(): Promise<MySellerSettings> {
  const result = await apiFetch<MySellerSettings>("/seller/settings");
  if (!result) {
    throw new Error("Resposta vazia ao carregar as configurações da loja.");
  }
  return result;
}

export interface UpdateMySellerSettingsInput {
  tradeName?: string;
  phone?: string;
  description?: string;
}

export async function updateMySellerSettings(
  input: UpdateMySellerSettingsInput,
): Promise<MySellerSettings> {
  const result = await apiFetch<MySellerSettings>("/seller/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia ao salvar as configurações da loja.");
  }
  return result;
}
