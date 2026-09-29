import { apiFetch } from "./client";
import type { SellerOrderForSellerResponse } from "./orders";

/** Mirrors sellers-service's Prisma SellerStatus enum (prisma/schema.prisma). */
export type AdminSellerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export const ADMIN_SELLER_STATUS_LABEL: Record<AdminSellerStatus, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  REJECTED: "Rejeitado",
};

/** Mirrors sellers-service's DocumentType enum. */
export type AdminSellerDocumentType = "CPF" | "CNPJ";

/**
 * Mirrors AdminService.SELLER_LIST_SELECT (sellers-service,
 * modules/admin/admin.service.ts) exactly — this is everything
 * GET /admin/sellers returns per row. There is no GET /admin/sellers/:id
 * and no admin endpoint for a seller's products/orders/audit history —
 * those don't exist yet, so there is no real data to back a detail page.
 */
export interface AdminSeller {
  id: string;
  legalName: string;
  tradeName: string;
  slug: string;
  documentType: AdminSellerDocumentType;
  documentNumber: string;
  email: string;
  status: AdminSellerStatus;
  statusReason: string | null;
  reviewedAt: string | null;
  commissionBps: number | null;
  createdAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Result shape of every PATCH /admin/sellers/:id/(approve|reject|suspend) call. */
export interface AdminSellerReviewResult {
  id: string;
  tradeName: string;
  status: AdminSellerStatus;
  statusReason: string | null;
  reviewedAt: string | null;
}

/**
 * GET /admin/sellers — cursor-paginated, no search/status filter server-side
 * (same PaginationQueryDto as everywhere else in this backend: only
 * limit/cursor). Finding pending sellers among many pages means paging
 * through them; there's no way to ask the backend for "only PENDING" yet.
 */
export async function listAdminSellers(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminSeller>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminSeller>>(
    `/admin/sellers${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

async function reviewSeller(
  id: string,
  action: "approve" | "reject" | "suspend",
  reason?: string,
): Promise<AdminSellerReviewResult> {
  const result = await apiFetch<AdminSellerReviewResult>(
    `/admin/sellers/${encodeURIComponent(id)}/${action}`,
    {
      method: "PATCH",
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export function approveSeller(id: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "approve");
}

export function rejectSeller(id: string, reason?: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "reject", reason);
}

export function suspendSeller(id: string, reason?: string): Promise<AdminSellerReviewResult> {
  return reviewSeller(id, "suspend", reason);
}

/** Mirrors catalog-service's Prisma CategoryStatus enum. */
export type AdminCategoryStatus = "ACTIVE" | "INACTIVE";

export const ADMIN_CATEGORY_STATUS_LABEL: Record<AdminCategoryStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
};

/** Mirrors AdminCategoriesController's response shape (catalog-service) exactly. */
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  status: AdminCategoryStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /admin/categories — every category, ACTIVE and INACTIVE, unpaginated
 * (small dataset, same call shape as GET /seller/categories). No search/
 * filter server-side; the list is short enough to filter client-side if
 * ever needed.
 */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const result = await apiFetch<AdminCategory[]>("/admin/categories");
  return result ?? [];
}

/** POST /admin/categories — slug is always derived from `name` server-side, never sent here. */
export async function createAdminCategory(name: string): Promise<AdminCategory> {
  const result = await apiFetch<AdminCategory>("/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PATCH /admin/categories/:id — partial; renaming regenerates the slug server-side. */
export async function updateAdminCategory(
  id: string,
  patch: { name?: string; status?: AdminCategoryStatus },
): Promise<AdminCategory> {
  const result = await apiFetch<AdminCategory>(
    `/admin/categories/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * GET /admin/orders — new this session (orders-service, via o gateway).
 * Mesmo shape de GET /seller/orders (SellerOrderForSellerResponse), só que
 * marketplace-wide em vez de escopado a um vendedor: cada linha já traz
 * `sellerId`, mas não o nome da loja (não há FK cross-schema pra esse join
 * no backend) — resolva o nome via listAdminSellers() quando precisar
 * exibir, mesmo padrão que o resto do admin panel já usa pra mapear
 * sellerId -> nome.
 */
export type AdminSellerOrder = SellerOrderForSellerResponse;

export async function listAdminOrders(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminSellerOrder>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminSellerOrder>>(
    `/admin/orders${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

/** Mirrors identity-service's Prisma UserStatus enum. */
export type AdminCustomerStatus = "ACTIVE" | "BLOCKED" | "PENDING_VERIFICATION";

export const ADMIN_CUSTOMER_STATUS_LABEL: Record<AdminCustomerStatus, string> = {
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  PENDING_VERIFICATION: "Aguardando verificação",
};

/**
 * Mirrors AdminService.listCustomers's return shape (identity-service,
 * modules/admin/admin.service.ts) exactly — everything GET /admin/customers
 * returns per row. Preenche uma lacuna deixada de propósito quando
 * identity-service foi extraído do monólito (o comentário de
 * AdminService.SELLER_LIST_SELECT em sellers-service já dizia "user
 * review/list/ban endpoints stay in identity-service" — nunca tinham sido
 * construídos até agora). Sem AuditLog nesta service (diferente de
 * sellers-service/catalog-service) — bloquear/desbloquear não fica
 * registrado em nenhum lugar, só o status muda.
 */
export interface AdminCustomer {
  id: string;
  email: string;
  status: AdminCustomerStatus;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
}

/**
 * GET /admin/customers — cursor-paginated, no search/status filter
 * server-side (mesma PaginationQueryDto de sempre: só limit/cursor).
 */
export async function listAdminCustomers(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminCustomer>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminCustomer>>(
    `/admin/customers${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

/** Result shape of PATCH /admin/customers/:id/(block|unblock). */
export interface AdminCustomerStatusResult {
  id: string;
  email: string;
  status: AdminCustomerStatus;
  reason: string | null;
}

async function setCustomerStatus(
  id: string,
  action: "block" | "unblock",
  reason?: string,
): Promise<AdminCustomerStatusResult> {
  const result = await apiFetch<AdminCustomerStatusResult>(
    `/admin/customers/${encodeURIComponent(id)}/${action}`,
    {
      method: "PATCH",
      body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export function blockCustomer(id: string, reason?: string): Promise<AdminCustomerStatusResult> {
  return setCustomerStatus(id, "block", reason);
}

export function unblockCustomer(id: string, reason?: string): Promise<AdminCustomerStatusResult> {
  return setCustomerStatus(id, "unblock", reason);
}

/**
 * "Todos os produtos" (admin) -- pedido de Arthur ("pode seguir com
 * esse"), ver status-migracao-microservicos.md. Real via
 * GET/PATCH /admin/products (catalog-service, novo nesta sessão).
 * Substitui o mock antigo (ProductsView.tsx + ProductDetailView.tsx --
 * `useAdminData`, `db.products`, com busca, filtro por status, ordenar,
 * exportar CSV, seleção em lote, Aprovar/Rejeitar (fluxo de moderação
 * REVIEW -> ACTIVE/REJECTED), Destacar e Editar título/preço/estoque).
 *
 * Removido de propósito, mesmo raciocínio já usado em
 * CustomersView.tsx/OrdersView.tsx:
 * - Sem busca, filtro por status nem ordenar server-side: o backend só
 *   pagina por cursor (PaginationQueryDto: limit/cursor), mesmo padrão
 *   minimalista do resto do admin panel.
 * - Sem exportar CSV: só exportaria a página atual, não todos os produtos.
 * - Sem seleção em lote: não existe endpoint de ação em lote.
 * - Sem Aprovar/Rejeitar: REVIEW e REJECTED nunca são usados por nenhum
 *   fluxo real nesta v1 -- Product.status nasce DRAFT e só sai daí via
 *   ACTIVE/INACTIVE (ver o comentário de UpdateProductStatusDto no
 *   catalog-service). Inventar uma tela de aprovação pra um status que o
 *   backend nunca atribui seria só teatro.
 * - Sem Destacar: não existe endpoint pra mudar `featured`.
 * - Sem Editar título/preço/estoque: não existe endpoint admin pra isso
 *   (editar é uma ação do vendedor dono do produto, não do admin).
 * - Sem link pra tela de detalhe: não existe GET /admin/products/:id --
 *   a ProductDetailView.tsx antiga também inventava moderationNote,
 *   timeline e attributes, nenhum dos quais existe no schema Product.
 *
 * Fica só o que o backend sustenta de verdade: listar todo o catálogo
 * (qualquer loja, qualquer status) e ativar/desativar um produto de
 * qualquer loja -- o equivalente admin, cross-tenant, do
 * "Ativar/Desativar" que o próprio vendedor já tem em
 * PATCH /seller/products/:id.
 */
export type AdminProductStatus = "DRAFT" | "REVIEW" | "ACTIVE" | "REJECTED" | "INACTIVE";

export const ADMIN_PRODUCT_STATUS_LABEL: Record<AdminProductStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  ACTIVE: "Ativo",
  REJECTED: "Rejeitado",
  INACTIVE: "Inativo",
};

export interface AdminProductVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number | null;
  inventory: {
    quantity: number;
    reservedQuantity: number;
  };
}

/** Mirrors AdminProductsController's response shape (catalog-service) exactly. */
export interface AdminProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  status: AdminProductStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  variants: AdminProductVariant[];
}

/**
 * GET /admin/products -- cursor-paginated, todo o catálogo (qualquer
 * loja, qualquer status). Sem busca/filtro server-side, mesma
 * PaginationQueryDto de sempre (só limit/cursor).
 */
export async function listAdminProducts(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminProduct>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminProduct>>(
    `/admin/products${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

async function setProductStatus(
  id: string,
  action: "activate" | "deactivate",
): Promise<AdminProduct> {
  const result = await apiFetch<AdminProduct>(
    `/admin/products/${encodeURIComponent(id)}/${action}`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export function activateAdminProduct(id: string): Promise<AdminProduct> {
  return setProductStatus(id, "activate");
}

export function deactivateAdminProduct(id: string): Promise<AdminProduct> {
  return setProductStatus(id, "deactivate");
}

/** Soma o `quantity` de todas as variantes -- não existe um campo de estoque no Product em si. */
export function totalAdminProductStock(product: AdminProduct): number {
  return product.variants.reduce((sum, v) => sum + v.inventory.quantity, 0);
}

/**
 * "Conteúdos / Cursos" (admin) -- pedido de Arthur (28/09), domínio novo
 * (ver status-migracao-microservicos.md). Real via
 * GET/POST/PATCH /admin/contents (catalog-service, novo). Substitui o mock
 * antigo (ContentsView.tsx + ContentDetailView.tsx -- `useAdminData`,
 * `db.contents`, com busca, filtro por status, exportar CSV, módulos/aulas,
 * e um contador de "alunos").
 *
 * Escopo v1 escolhido com o Arthur via pergunta antes de codar: só cadastro
 * e moderação (mesmo tamanho da tela mock), sem módulos/aulas, sem compra,
 * sem aluno consumindo nada -- e só o admin cadastra (instrutor continua
 * texto livre, sem vínculo com Seller nenhum).
 *
 * Removido de propósito, mesmo raciocínio já usado em ProductsView.tsx:
 * - Sem busca/filtro por status server-side: o backend só pagina por
 *   cursor (mesma PaginationQueryDto de sempre).
 * - Sem exportar CSV: só exportaria a página atual.
 * - Sem "Alunos": não existe matrícula/compra nesta v1 -- o número no mock
 *   era só decorativo, nunca teve contrapartida real.
 * - Sem módulos/aulas: fora de escopo desta rodada (decisão explícita).
 * - Sem link pra tela de detalhe: não existe GET /admin/contents/:id -- a
 *   ContentDetailView.tsx antiga foi deixada como está, inacessível a
 *   partir da lista agora, mesma decisão já tomada com
 *   ProductDetailView.tsx/SellerDetailView.tsx.
 *
 * Status é sempre movido por uma das 4 transições dedicadas abaixo, nunca
 * por um campo `status` solto em POST/PATCH -- mesmo raciocínio do backend
 * (ver comentário de CreateContentDto/UpdateContentDto).
 */
export type AdminContentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type AdminContentFormat = "VIDEO" | "LIVE" | "TEXT";

export const ADMIN_CONTENT_STATUS_LABEL: Record<AdminContentStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicado",
  REJECTED: "Rejeitado",
  ARCHIVED: "Arquivado",
};

export const ADMIN_CONTENT_FORMAT_LABEL: Record<AdminContentFormat, string> = {
  VIDEO: "Vídeo",
  LIVE: "Ao vivo",
  TEXT: "Texto",
};

/** Mirrors AdminContentsController's response shape (catalog-service) exactly. */
export interface AdminContent {
  id: string;
  title: string;
  instructor: string;
  category: string;
  format: AdminContentFormat;
  priceCents: number;
  status: AdminContentStatus;
  description: string;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /admin/contents -- cursor-paginado, todo o conteúdo (qualquer
 * status). Sem busca/filtro server-side, mesma PaginationQueryDto de
 * sempre (só limit/cursor).
 */
export async function listAdminContents(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminContent>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminContent>>(
    `/admin/contents${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

export interface CreateAdminContentInput {
  title: string;
  instructor: string;
  category: string;
  format: AdminContentFormat;
  priceCents: number;
  description?: string;
}

/** POST /admin/contents -- sempre nasce DRAFT (sem campo status no payload). */
export async function createAdminContent(
  input: CreateAdminContentInput,
): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>("/admin/contents", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

export interface UpdateAdminContentInput {
  title?: string;
  instructor?: string;
  category?: string;
  format?: AdminContentFormat;
  priceCents?: number;
  description?: string;
}

/** PATCH /admin/contents/:id -- parcial, nunca muda status (ver as 4 transições abaixo). */
export async function updateAdminContent(
  id: string,
  input: UpdateAdminContentInput,
): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>(
    `/admin/contents/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** DRAFT -> REVIEW. */
export async function submitAdminContentForReview(id: string): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>(
    `/admin/contents/${encodeURIComponent(id)}/submit-for-review`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** REVIEW -> PUBLISHED. */
export async function approveAdminContent(id: string): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>(
    `/admin/contents/${encodeURIComponent(id)}/approve`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** REVIEW -> REJECTED, com nota opcional (motivo). */
export async function rejectAdminContent(
  id: string,
  note?: string,
): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>(
    `/admin/contents/${encodeURIComponent(id)}/reject`,
    { method: "PATCH", body: JSON.stringify({ note }) },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/** PUBLISHED -> ARCHIVED. */
export async function archiveAdminContent(id: string): Promise<AdminContent> {
  const result = await apiFetch<AdminContent>(
    `/admin/contents/${encodeURIComponent(id)}/archive`,
    { method: "PATCH" },
  );
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}

/**
 * Mirrors AdminService.listAdmins/createAdmin's return shape
 * (identity-service, modules/admin/admin.service.ts) exactly. Só um admin
 * já autenticado consegue chegar em POST /admin/admins -- não existe rota
 * pública de auto-cadastro de admin em lugar nenhum (decisão explícita,
 * ver status-migracao-microservicos.md).
 */
export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
}

/** GET /admin/admins -- cursor-paginated, mesma PaginationQueryDto de sempre. */
export async function listAdminAdmins(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paginated<AdminUser>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const result = await apiFetch<Paginated<AdminUser>>(
    `/admin/admins${qs ? `?${qs}` : ""}`,
  );
  return result ?? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  name: string;
}

/** POST /admin/admins -- cria um novo admin, sempre ACTIVE. */
export async function createAdminAdmin(input: CreateAdminUserInput): Promise<AdminUser> {
  const result = await apiFetch<AdminUser>("/admin/admins", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result) {
    throw new Error("Resposta vazia do servidor.");
  }
  return result;
}
