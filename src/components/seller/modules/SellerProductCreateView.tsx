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
// Mirrors catalog-service's products.constants.ts (MAX_PRODUCT_IMAGE_URLS / MAX_IMAGE_URL_LENGTH) — kept in sync manually, there is no shared package between frontend and backend here.
const MAX_IMAGE_URLS = 6;
const MAX_IMAGE_URL_LENGTH = 2048;

/**
 * Real criação via POST /seller/products (catalog-service). Um produto = uma
 * variante aqui (nome fixo "Padrão", só SKU e estoque pedidos ao vendedor) —
 * decisão explícita do Arthur: o backend já suporta múltiplas variantes por
 * produto, mas esta tela não expõe isso ainda (ver status do projeto).
 *
 * Categoria vem de GET /seller/categories (novo endpoint, catalog-service) —
 * antes desta sessão não existia forma nenhuma do frontend descobrir um
 * categoryId válido, o que bloqueava esta tela inteira.
 *
 * Imagens: não existe endpoint de upload (ver status do projeto) — o
 * vendedor cola URLs de imagens já hospedadas em outro lugar. Campo
 * totalmente opcional, até MAX_IMAGE_URLS entradas, mesma regra do
 * CreateProductDto.imageUrls no catalog-service.
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
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

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

  function updateImageUrl(index: number, value: string) {
    setImageUrls((current) => current.map((url, i) => (i === index ? value : url)));
  }

  function addImageUrl() {
    setImageUrls((current) =>
      current.length >= MAX_IMAGE_URLS ? current : [...current, ""],
    );
  }

  function removeImageUrl(index: number) {
    setImageUrls((current) => current.filter((_, i) => i !== index));
  }

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

    const trimmedImageUrls = imageUrls.map((url) => url.trim()).filter(Boolean);
    for (const url of trimmedImageUrls) {
      if (url.length > MAX_IMAGE_URL_LENGTH) {
        setFormError(`Cada URL de imagem pode ter no máximo ${MAX_IMAGE_URL_LENGTH} caracteres.`);
        return;
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("protocol");
        }
      } catch {
        setFormError(`URL de imagem inválida: ${url}`);
        return;
      }
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
        imageUrls: trimmedImageUrls.length > 0 ? trimmedImageUrls : undefined,
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

        <div className={styles.field}>
          <label>Imagens (URLs)</label>
          <p style={{ fontSize: "0.82rem", color: "var(--seller-muted)", marginTop: -2, marginBottom: 8 }}>
            Opcional. Cole links de imagens já hospedadas em outro lugar (até {MAX_IMAGE_URLS}). Sem
            isso, o produto aparece na vitrine com uma imagem genérica.
          </p>
          {imageUrls.map((url, index) => (
            <div
              key={index}
              style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}
            >
              <input
                aria-label={`URL da imagem ${index + 1}`}
                value={url}
                onChange={(event) => updateImageUrl(index, event.target.value)}
                placeholder="https://…"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => removeImageUrl(index)}
                disabled={imageUrls.length === 1}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={addImageUrl}
            disabled={imageUrls.length >= MAX_IMAGE_URLS}
          >
            + Adicionar imagem
          </button>
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
