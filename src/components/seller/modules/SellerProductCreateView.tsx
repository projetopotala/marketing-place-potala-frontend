"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/shared/AdminToastProvider";
import {
  createSellerProduct,
  listSellerCategories,
  type SellerCategory,
} from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import styles from "@/components/seller/seller.module.css";

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Real criação via POST /seller/products (catalog-service). Um produto = uma
 * variante aqui (nome fixo "Padrão", só SKU e estoque pedidos ao vendedor) —
 * decisão explícita do Arthur: o backend já suporta múltiplas variantes por
 * produto, mas esta tela não expõe isso ainda (ver status do projeto).
 *
 * Categoria vem de GET /seller/categories (novo endpoint, catalog-service) —
 * antes desta sessão não existia forma nenhuma do frontend descobrir um
 * categoryId válido, o que bloqueava esta tela inteira.
 */
export function SellerProductCreateView() {
  const router = useRouter();
  const toast = useAdminToast();

  const [categories, setCategories] = useState<SellerCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("0");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSellerCategories()
      .then((result) => {
        if (cancelled) return;
        setCategories(result);
        if (result.length > 0) setCategoryId((current) => current || result[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        setCategories([]);
        setCategoriesError(
          err instanceof ApiError ? err.message : "Não foi possível carregar as categorias.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setFormError("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setFormError(`O título pode ter no máximo ${MAX_TITLE_LENGTH} caracteres.`);
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setFormError(`A descrição pode ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    if (!categoryId) {
      setFormError("Selecione uma categoria.");
      return;
    }

    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setFormError("Preço inválido.");
      return;
    }

    const trimmedSku = sku.trim();
    if (!trimmedSku) {
      setFormError("Informe um SKU.");
      return;
    }

    const quantityValue = Number.parseInt(quantity, 10);
    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      setFormError("Estoque inválido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const product = await createSellerProduct({
        title: trimmedTitle,
        description,
        categoryId,
        priceCents,
        sku: trimmedSku,
        quantity: quantityValue,
      });
      toast.push(`${product.title} criado com sucesso.`);
      router.push(`/loja/produtos/${product.id}`);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Não foi possível criar o produto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (categories === null) {
    return <p role="status">Carregando formulário…</p>;
  }

  return (
    <>
      <header>
        <h1 className={styles.pageTitle}>Novo produto</h1>
        <p className={styles.pageLead}>
          O produto é criado com uma variante única — SKU e estoque abaixo.
        </p>
      </header>

      {categoriesError ? (
        <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
          {categoriesError}
        </p>
      ) : null}

      <form className={`${styles.panel} ${styles.formGrid}`} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="np-title">Título</label>
          <input
            id="np-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="np-description">Descrição</label>
          <textarea
            id="np-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="np-category">Categoria</label>
          <select
            id="np-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={categories.length === 0}
            required
          >
            {categories.length === 0 ? (
              <option value="">Nenhuma categoria disponível</option>
            ) : (
              categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="np-price">Preço (R$)</label>
          <input
            id="np-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="np-sku">SKU</label>
          <input
            id="np-sku"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="np-stock">Estoque</label>
          <input
            id="np-stock"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </div>

        {formError ? (
          <p role="alert" style={{ color: "var(--potala-danger, #c95c57)" }}>
            {formError}
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={isSubmitting || categories.length === 0}
          >
            {isSubmitting ? "Criando…" : "Criar produto"}
          </button>
        </div>
      </form>
    </>
  );
}
