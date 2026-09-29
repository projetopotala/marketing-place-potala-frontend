import { apiFetch } from "./client";

/**
 * Perfil rico do cliente em `/minha-conta` (ver
 * status-migracao-microservicos.md no Claude Project). Client for
 * identity-service's `/customers/me*`, acessado pelo gateway como
 * qualquer outra chamada autenticada (`apiFetch` já manda
 * `credentials: "include"`).
 *
 * Atualizado nesta sessão: `/customers/me` ganhou PATCH (nome/telefone) e
 * `/customers/me/addresses` ganhou o CRUD completo (POST/PATCH/DELETE +
 * marcar padrão) — `/minha-conta/enderecos` e `/minha-conta/configuracoes`
 * deixam de usar CRUD local (AccountDataContext/localStorage) e passam a
 * chamar essas funções direto, mesmo padrão já usado por
 * avaliações/cupons do cliente.
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

/**
 * PATCH /customers/me — atualiza nome exibido/telefone. E-mail fica de
 * fora (sem endpoint, sem fluxo de troca de e-mail nesta v1 — mesma
 * decisão já refletida no campo `readOnly` da tela). Ação explícita do
 * cliente: não degrada em silêncio, o form precisa saber se falhou.
 */
export async function updateMyProfile(input: {
  fullName?: string;
  phone?: string;
}): Promise<CustomerProfileResponse> {
  const result = await apiFetch<CustomerProfileResponse>("/customers/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export interface AddressInput {
  label?: string;
  recipient: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault?: boolean;
}

/** POST /customers/me/addresses — cria um endereço novo. Não degrada em silêncio. */
export async function createMyAddress(
  input: AddressInput,
): Promise<CustomerAddressResponse> {
  const result = await apiFetch<CustomerAddressResponse>("/customers/me/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /customers/me/addresses/:id — atualização parcial. Não degrada em silêncio. */
export async function updateMyAddress(
  id: string,
  input: Partial<AddressInput>,
): Promise<CustomerAddressResponse> {
  const result = await apiFetch<CustomerAddressResponse>(
    `/customers/me/addresses/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * DELETE /customers/me/addresses/:id — backend recusa remover o endereço
 * padrão (400, mesma regra de negócio que já existia no mock local: ver
 * CustomersService.deleteAddress em potala-identity-service). Não degrada
 * em silêncio, a tela precisa mostrar a mensagem de erro real.
 */
export async function deleteMyAddress(id: string): Promise<void> {
  await apiFetch<null>(`/customers/me/addresses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** PATCH /customers/me/addresses/:id/default — marca este endereço como padrão. */
export async function setMyDefaultAddress(
  id: string,
): Promise<CustomerAddressResponse> {
  const result = await apiFetch<CustomerAddressResponse>(
    `/customers/me/addresses/${encodeURIComponent(id)}/default`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
