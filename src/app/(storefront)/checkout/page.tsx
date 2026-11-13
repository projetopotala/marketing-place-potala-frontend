"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import type { CheckoutPaymentMethod, CurrentOrderSummary, ShippingOptionId } from "@/types/cart";
import { calcLineTotal, ORDER_STORAGE_KEY, PAYMENT_LABELS } from "@/data/cart";
import { formatPrice } from "@/data/marketplace";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useAccountData } from "@/features/account/AccountDataContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { checkout as checkoutApi, type OrderResponse } from "@/lib/api/orders";
import { ApiError, apiFetch } from "@/lib/api/client";
import styles from "./page.module.css";

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}
type FreightQuote = {sellerId: string; method: 'PICKUP' | 'DELIVERY' | 'NONE'; priceCents: number; estimatedDays: number; pickupAddress?: string};
type FreightResult = {stores: Array<{sellerId: string; options: FreightQuote[]; selected: FreightQuote | null}>; shippingCents: number; discountCents: number; totalCents: number; available: boolean};

/**
 * Mapeia a resposta real de POST /orders/checkout (potala-orders-service)
 * pro mesmo formato CurrentOrderSummary que checkout/sucesso/page.tsx já
 * sabe renderizar — nenhuma mudança foi necessária lá. Preço/título/SKU de
 * cada item vêm sempre do servidor (nunca do que o carrinho local mandou);
 * imageSrc/slug não existem na resposta do orders-service, então são
 * recuperados do carrinho local pelo productId só pra exibição.
 */
function buildOrderSummaryFromResponse(
  response: OrderResponse,
  context: {
    cartItemsByProductId: Map<string, { slug: string; imageSrc: string }>;
    shipping: ShippingOptionId;
    shippingLabel: string;
    payment: CheckoutPaymentMethod;
    paymentLabel: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    fallbackAddress: CurrentOrderSummary["shippingAddress"];
  },
): CurrentOrderSummary {
  const items = response.sellerOrders.flatMap((sellerOrder) =>
    sellerOrder.items.map((item) => {
      const local = context.cartItemsByProductId.get(item.productId);
      return {
        productId: item.productId,
        slug: local?.slug ?? item.productId,
        name: item.productTitle,
        imageSrc: local?.imageSrc ?? "/images/potala/logo-mark.png",
        quantity: item.quantity,
        unitPrice: item.unitPriceCents / 100,
        lineTotal: item.lineTotalCents / 100,
      };
    }),
  );

  const address = response.shippingAddress;

  return {
    orderId: response.orderNumber,
    checkoutTransactionId: response.id,
    items,
    subtotal: response.subtotalCents / 100,
    discount: response.discountCents / 100,
    shippingOption: context.shipping,
    shippingLabel: context.shippingLabel,
    shippingCost: response.shippingCents / 100,
    total: response.totalCents / 100,
    paymentMethod: context.payment,
    paymentLabel: context.paymentLabel,
    customerName: context.customerName,
    customerEmail: context.customerEmail,
    customerPhone: context.customerPhone,
    shippingAddress: address
      ? {
          cep: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement ?? undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
        }
      : context.fallbackAddress,
    createdAt: response.createdAt,
  };
}

function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal, isReady, consumeCheckoutItems } = useCart();
  const { user } = useAuth();
  const {
    appendOrderFromCheckout,
    isHydrated: accountHydrated,
  } = useAccountData();
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const checkoutAttempt = useRef<{payload: string; key: string} | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const shipping: ShippingOptionId = "economic";
  const [couponCode, setCouponCode] = useState("");
  const [payment, setPayment] = useState<CheckoutPaymentMethod>("pix");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [deliveryChoices, setDeliveryChoices] = useState<Array<{sellerId: string; method: 'PICKUP' | 'DELIVERY' | 'CARRIER'}>>([]);
  const [freight, setFreight] = useState<{key: string; result: FreightResult} | null>(null);
  const [quoting, setQuoting] = useState(false);
  const freightKey = JSON.stringify([items.map(i => [i.productId, i.variantId, i.quantity]), fullName, street, number, complement, neighborhood, city, state, cep, couponCode, deliveryChoices]);
  const freightCurrent = freight?.key === freightKey;
  async function calculateFreight() {
    setQuoting(true); setStatus(null);
    try {
      const result = await apiFetch<FreightResult>('/orders/shipping-quote', {method: 'POST', body: JSON.stringify({items: items.map(i => ({productId: i.productId, variantId: i.variantId, quantity: i.quantity})), shippingAddress: {recipient: fullName.trim(), street: street.trim(), number: number.trim(), complement: complement.trim() || undefined, neighborhood: neighborhood.trim(), city: city.trim(), state: state.trim().toUpperCase(), postalCode: cep.trim()}, deliveryChoices, ...(couponCode.trim() ? {couponCode: couponCode.trim()} : {})})});
      if (result) setFreight({key: freightKey, result});
    } catch(e) {setStatus(e instanceof Error ? e.message : 'Falha ao calcular entrega');} finally {setQuoting(false);}
  }

  // orders-service ainda não calcula frete real nesta v1 (Order.shippingCents
  // sempre 0, ver README do serviço) — a escolha de prazo continua na UI
  // (informativa), mas o total exibido aqui (e o total real devolvido pelo
  // pedido confirmado) não soma o custo fixo de SHIPPING_OPTIONS, pra não
  // divergir do valor que o backend efetivamente cobra.
  const total = freightCurrent ? freight.result.totalCents / 100 : subtotal;

  const isCustomer = user?.role === "customer";

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!fullName.trim()) next.fullName = "Informe seu nome completo.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Informe um e-mail válido.";
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
      next.phone = "Informe um telefone válido.";
    }
    if (!cep.trim() || cep.replace(/\D/g, "").length < 8) {
      next.cep = "Informe um CEP válido.";
    }
    if (!street.trim()) next.street = "Informe a rua.";
    if (!number.trim()) next.number = "Informe o número.";
    if (!neighborhood.trim()) next.neighborhood = "Informe o bairro.";
    if (!city.trim()) next.city = "Informe a cidade.";
    if (!state.trim() || state.trim().length !== 2) {
      next.state = "Informe o UF com 2 letras.";
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus("Revise os campos destacados para continuar.");
      return;
    }

    if (isCustomer && !accountHydrated) {
      setStatus(
        "Aguarde o carregamento da sua conta antes de finalizar o pedido.",
      );
      return;
    }

    if (submitting) {
      return;
    }
    if (!freightCurrent || !freight.result.available) {setStatus('Calcule e confirme uma opção disponível de entrega ou retirada para cada loja.'); return;}

    const missingVariant = items.find((item) => !item.variantId);
    if (missingVariant) {
      setStatus(
        `"${missingVariant.name}" está sem variante associada — remova e adicione o produto novamente ao carrinho.`,
      );
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const cartItemsByProductId = new Map(
      items.map((item) => [item.productId, { slug: item.slug, imageSrc: item.imageSrc }]),
    );
    const fallbackAddress = {
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
    };

    try {
      // Preço/título/SKU nunca vêm daqui — o servidor resolve tudo a
      // partir de productId/variantId (ver CreateCheckoutDto no
      // orders-service). Sem chave de idempotência nesta v1: um retry de
      // rede cria um pedido novo — o guard `submitting` acima evita o caso
      // mais comum (duplo clique), mas não uma falha de rede a meio do
      // caminho (gap conhecido, ver status do projeto).
      const checkoutInput = {
        paymentMethod: payment === 'pix' ? 'PIX' as const : 'CARD' as const,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingAddress: {
          recipient: fullName.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          postalCode: cep.trim(),
        },
        deliveryChoices: freight.result.stores.flatMap(s => s.selected && s.selected.method !== 'NONE' ? [{sellerId: s.sellerId, method: s.selected.method}] : []),
        // Backend valida (código, janela de vigência, habilitado) e
        // rejeita o checkout inteiro com uma mensagem clara se inválido
        // (CouponsService.resolveForCheckout, orders-service) -- ver
        // status-migracao-microservicos.md. Omitido quando vazio: o campo
        // é opcional, sem cupom nenhum aplicado.
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      };
      const payload = JSON.stringify(checkoutInput);
      if (checkoutAttempt.current?.payload !== payload) checkoutAttempt.current = {payload, key: crypto.randomUUID()};
      const response = await checkoutApi(checkoutInput, checkoutAttempt.current.key);

      const canonicalOrder = buildOrderSummaryFromResponse(response, {
        cartItemsByProductId,
        shipping,
        shippingLabel: 'Entrega/retirada conforme opções confirmadas por loja',
        payment,
        paymentLabel: PAYMENT_LABELS[payment],
        customerName: fullName.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        fallbackAddress,
      });

      if (isCustomer) {
        // Best-effort: histórico demonstrativo da conta (localStorage,
        // AccountDataContext — ainda não migrado pra API real, ver status
        // do projeto), em paralelo ao pedido real já gravado no
        // orders-service. Se isso falhar o pedido real já existe de
        // qualquer forma, então não bloqueia a confirmação.
        appendOrderFromCheckout(canonicalOrder);
      }

      window.sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(canonicalOrder));

      consumeCheckoutItems(
        canonicalOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );

      router.push("/checkout/sucesso");
    } catch (err) {
      setSubmitting(false);
      setStatus(
        err instanceof ApiError
          ? err.message
          : "Não foi possível finalizar o pedido. Tente novamente.",
      );
    }
  }

  if (!isReady) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p role="status">Carregando checkout…</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Checkout</h1>
          <div className={styles.empty}>
            <p>Não há itens no carrinho para finalizar a compra.</p>
            <Link href="/#produtos" className={styles.primaryBtn}>
              Voltar ao marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const finalizeDisabled = submitting || (isCustomer && !accountHydrated);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Início</Link>
            </li>
            <li>
              <Link href="/carrinho">Carrinho</Link>
            </li>
            <li aria-current="page">Checkout</li>
          </ol>
        </nav>

        <h1 className={styles.title}>Checkout</h1>

        <form className={styles.layout} onSubmit={handleSubmit} noValidate>
          <div className={styles.forms}>
            <fieldset className={styles.fieldset}>
              <legend>Identificação</legend>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-name`}>Nome completo</label>
                  <input
                    id={`${formId}-name`}
                    name="fullName"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? `${formId}-name-error` : undefined}
                  />
                  {errors.fullName ? (
                    <p id={`${formId}-name-error`} className={styles.error}>
                      {errors.fullName}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-email`}>E-mail</label>
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                  />
                  {errors.email ? (
                    <p id={`${formId}-email-error`} className={styles.error}>
                      {errors.email}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-phone`}>Telefone</label>
                  <input
                    id={`${formId}-phone`}
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? `${formId}-phone-error` : undefined}
                  />
                  {errors.phone ? (
                    <p id={`${formId}-phone-error`} className={styles.error}>
                      {errors.phone}
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Endereço</legend>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-cep`}>CEP</label>
                  <input
                    id={`${formId}-cep`}
                    name="cep"
                    required
                    inputMode="numeric"
                    value={cep}
                    onChange={(event) => setCep(event.target.value)}
                    aria-invalid={Boolean(errors.cep)}
                    aria-describedby={errors.cep ? `${formId}-cep-error` : undefined}
                  />
                  {errors.cep ? (
                    <p id={`${formId}-cep-error`} className={styles.error}>
                      {errors.cep}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-street`}>Rua</label>
                  <input
                    id={`${formId}-street`}
                    name="street"
                    required
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    aria-invalid={Boolean(errors.street)}
                    aria-describedby={errors.street ? `${formId}-street-error` : undefined}
                  />
                  {errors.street ? (
                    <p id={`${formId}-street-error`} className={styles.error}>
                      {errors.street}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-number`}>Número</label>
                  <input
                    id={`${formId}-number`}
                    name="number"
                    required
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                    aria-invalid={Boolean(errors.number)}
                    aria-describedby={errors.number ? `${formId}-number-error` : undefined}
                  />
                  {errors.number ? (
                    <p id={`${formId}-number-error`} className={styles.error}>
                      {errors.number}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-complement`}>Complemento</label>
                  <input
                    id={`${formId}-complement`}
                    name="complement"
                    value={complement}
                    onChange={(event) => setComplement(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-neighborhood`}>Bairro</label>
                  <input
                    id={`${formId}-neighborhood`}
                    name="neighborhood"
                    required
                    value={neighborhood}
                    onChange={(event) => setNeighborhood(event.target.value)}
                    aria-invalid={Boolean(errors.neighborhood)}
                    aria-describedby={
                      errors.neighborhood ? `${formId}-neighborhood-error` : undefined
                    }
                  />
                  {errors.neighborhood ? (
                    <p id={`${formId}-neighborhood-error`} className={styles.error}>
                      {errors.neighborhood}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-city`}>Cidade</label>
                  <input
                    id={`${formId}-city`}
                    name="city"
                    required
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    aria-invalid={Boolean(errors.city)}
                    aria-describedby={errors.city ? `${formId}-city-error` : undefined}
                  />
                  {errors.city ? (
                    <p id={`${formId}-city-error`} className={styles.error}>
                      {errors.city}
                    </p>
                  ) : null}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-state`}>Estado (UF)</label>
                  <input
                    id={`${formId}-state`}
                    name="state"
                    required
                    maxLength={2}
                    value={state}
                    onChange={(event) => setState(event.target.value.toUpperCase())}
                    aria-invalid={Boolean(errors.state)}
                    aria-describedby={errors.state ? `${formId}-state-error` : undefined}
                  />
                  {errors.state ? (
                    <p id={`${formId}-state-error`} className={styles.error}>
                      {errors.state}
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Entrega</legend>
              <div className={styles.options}>
                <p>Informe o endereço e consulte as opções autorizadas por cada loja. O pedido recalcula os valores antes de cobrar.</p>
                <button type="button" disabled={quoting} onClick={() => void calculateFreight()}>{quoting ? 'Calculando…' : 'Calcular entrega e cupom'}</button>
                {freight?.result.stores.map((store, i) => <fieldset key={store.sellerId}><legend>Loja {i + 1}</legend>
                  {!store.options.length && <p>Entrega e retirada indisponíveis para este endereço.</p>}
                  {store.options.map(option => <label key={option.method}><input type="radio" name={`delivery-${store.sellerId}`} checked={(deliveryChoices.find(c => c.sellerId === store.sellerId)?.method ?? store.selected?.method) === option.method} disabled={option.method === 'NONE'} onChange={() => {if (option.method !== 'NONE') setDeliveryChoices(previous => [...previous.filter(c => c.sellerId !== store.sellerId), {sellerId: store.sellerId, method: option.method as 'PICKUP' | 'DELIVERY'}]);}}/>
                    {option.method === 'PICKUP' ? 'Retirada' : option.method === 'NONE' ? 'Sem entrega física' : 'Entrega da loja'} — {formatPrice(option.priceCents / 100)} — {option.estimatedDays} dia(s) {option.pickupAddress}
                  </label>)}
                </fieldset>)}
                {freight && !freightCurrent && <p role="status">Endereço, itens, cupom ou opção alterados. Recalcule para confirmar.</p>}
                <p>Transportadora principal indisponível.</p>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Pagamento</legend>
              <div className={styles.options}>
                {(
                  [
                    ["pix", "Pix"],
                    ["card", "Cartão de crédito"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={styles.option}>
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={payment === value}
                      onChange={() => setPayment(value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>
                        Gateway indisponível; sujeito à aceitação de cada loja.
                      </small>
                    </span>
                  </label>
                ))}
              </div>

              <p>O provedor de pagamento ainda não foi integrado. Não informe dados de cartão ou chave Pix. Nenhuma cobrança ou repasse será aprovado artificialmente.</p>
            </fieldset>
          </div>

          <aside className={styles.summary} aria-labelledby="checkout-summary-title">
            <h2 id="checkout-summary-title">Resumo do pedido</h2>
            <ul className={styles.summaryItems}>
              {items.map((item) => (
                <li key={item.productId}>
                  <span className={styles.thumb}>
                    <Image src={item.imageSrc} alt="" fill sizes="56px" />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.quantity} × {formatPrice(item.unitPrice)}
                    </small>
                  </span>
                  <span>{formatPrice(calcLineTotal(item.unitPrice, item.quantity))}</span>
                </li>
              ))}
            </ul>

            <div className={styles.field}>
              <label htmlFor="checkout-coupon">Cupom de desconto (opcional)</label>
              <input
                id="checkout-coupon"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="Ex.: BEMVINDO10"
                maxLength={30}
              />
              <small>O desconto é validado e aplicado ao confirmar o pedido.</small>
            </div>

            <dl className={styles.totals}>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div>
                <dt>Entrega por loja</dt>
                <dd>{freightCurrent ? formatPrice(freight.result.shippingCents / 100) : 'A calcular'}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>{freightCurrent ? 'Total com desconto' : 'Subtotal estimado'}</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            {status ? (
              <p role="status" className={styles.status}>
                {status}
              </p>
            ) : null}

            {isCustomer && !accountHydrated ? (
              <p role="status" className={styles.status}>
                Carregando dados da conta…
              </p>
            ) : null}

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={finalizeDisabled}
            >
              {submitting ? "Finalizando…" : "Finalizar pedido"}
            </button>
            <Link href="/carrinho" className={styles.secondaryLink}>
              Voltar ao carrinho
            </Link>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutForm />
    </AuthGuard>
  );
}
