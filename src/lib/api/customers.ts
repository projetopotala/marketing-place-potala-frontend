import { apiFetch } from "./client";

/**
 * New this session — perfil rico do cliente em `/minha-conta` (ver
 * status-migracao-microservicos.md no Claude Project, item 3 do
 * Pendente). Client for identity-service's `GET /customers/me`
 * (CustomersController.getMe), acessado pelo gateway como qualquer outra
 * chamada autenticada (`apiFetch` já manda `credentials: "include"`).
 *
 * Único endpoint own-profile do cliente hoje — sem POST/PATCH/DELETE em
 * lugar nenhum de identity-service (confirmado em customers.controller.ts:
 * só `@Get('me')`). Isto é, os endereços abaixo são só leitura: não existe
 * como o cliente cadastrar/editar um endereço real pela API ainda —
 * `/minha-conta/enderecos` continua com seu próprio CRUD 100% local
 * (AccountDataContext/localStorage) até esse endpoint existir de verdade.
 */

export interface CustomerAddressResponse {
  id: string;
  label: string | null;
  recipient: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors CustomersService.getOwnProfile's return shape exactly. */
export interface CustomerProfileResponse {
  id: string;
  fullName: string | null;
  phone: string | null;
  addresses: CustomerAddressResponse[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns null instead of throwing on any failure — perfil ainda não
 * provisionado (404, não deveria acontecer pra uma sessão CUSTOMER válida,
 * mas o backend permite em teoria), rede indisponível, gateway/identity-
 * service fora do ar. `/minha-conta` já trata "sem perfil rico" como
 * "mostra só o que a sessão (GET /auth/me) já tinha" em vez de quebrar a
 * página — mesmo padrão de degradação gradual de catalog-public.ts.
 */
export async function getMyCustomerProfile(): Promise<CustomerProfileResponse | null> {
  try {
    return await apiFetch<CustomerProfileResponse>("/customers/me");
  } catch (err) {
    console.error("[customers] getMyCustomerProfile failed, degrading:", err);
    return null;
  }
}
