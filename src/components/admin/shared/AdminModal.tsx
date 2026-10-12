"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog, AlertDialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./shared.module.css";

interface AdminModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}

/**
 * Dialog controlado sem Trigger: captura o foco do gatilho antes do trap
 * e devolve após o fechamento (Escape / backdrop / onOpenChange).
 */
function useRestoreFocus(open: boolean) {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      previouslyFocused.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }

    if (!open && wasOpen.current) {
      const el = previouslyFocused.current;
      const timer = window.setTimeout(() => {
        if (el && typeof el.focus === "function") {
          el.focus();
        }
      }, 50);
      wasOpen.current = open;
      return () => window.clearTimeout(timer);
    }

    wasOpen.current = open;
  }, [open]);
}

export function AdminModal({
  open,
  title,
  children,
  onClose,
  actions,
}: AdminModalProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  useRestoreFocus(open);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className={styles.dialogBackdrop}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <div className={styles.dialogPositioner}>
              <Dialog.Content asChild aria-labelledby={titleId}>
                <motion.div
                  className={styles.dialog}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <Dialog.Title id={titleId} className={styles.dialogTitle}>
                    {title}
                  </Dialog.Title>
                  <div className={styles.dialogBody}>{children}</div>
                  {actions ? (
                    <div className={styles.dialogActions}>{actions}</div>
                  ) : null}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  busy = false,
  onConfirm,
  onClose,
  controlledClose = false,
  error = null,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /**
   * F4.3 -- AlertDialog.Action é, por baixo, exatamente
   * DialogPrimitive.Close (confirmado lendo @radix-ui/react-alert-dialog/
   * src/alert-dialog.tsx e @radix-ui/react-dialog/dist/index.mjs): seu
   * onClick é sempre composeEventHandlers(props.onClick, () =>
   * context.onOpenChange(false)), que fecha o diálogo de forma SÍNCRONA
   * assim que o onClick retorna -- mesmo quando ele só dispara uma
   * Promise em voo (`onConfirm={() => void confirmarAlgo()}`), ou seja,
   * antes da requisição HTTP terminar.
   *
   * Por padrão (`controlledClose = false`) o comportamento é IDÊNTICO ao
   * de antes desta revisão, preservando every consumidor existente
   * (CouponsView, CustomersView, ProductsView, ReturnsView, SellersView,
   * SellerDetailView, CustomerDetailView, SettingsView,
   * TransactionDetailView): nenhum deles passa esta prop, então nenhum
   * tem seu comportamento alterado.
   *
   * Quando true, suprime esse fechamento automático com
   * `event.preventDefault()` no clique de "Confirmar" -- só o consumidor
   * decide quando fechar (normalmente: ao suceder, limpando o estado
   * "pendente"; ao falhar, mantendo o diálogo aberto para mostrar o
   * erro). "Cancelar" também fica desabilitado enquanto `busy`, pelo
   * mesmo motivo que "Confirmar" já era: evitar fechar/cancelar o
   * diálogo com uma operação em andamento.
   */
  controlledClose?: boolean;
  /**
   * F4.3 -- erro a exibir dentro do próprio diálogo. Só tem efeito
   * prático combinado com controlledClose=true: sem ele, o diálogo já
   * teria fechado (pelo Radix) antes de qualquer erro poder aparecer, e
   * o texto apareceria atrás do backdrop. Opcional, `null` por padrão --
   * sem efeito nos consumidores existentes.
   */
  error?: string | null;
}) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // F4.4 -- proteção residual: onOpenChange(false) não chega só pelo
        // clique em "Cancelar" (que já fica disabled={controlledClose &&
        // busy}) -- a tecla Escape passa pelo MESMO onOpenChange por um
        // caminho totalmente separado. Confirmado lendo
        // @radix-ui/react-dismissable-layer/dist/index.mjs: o listener de
        // keydown do próprio documento chama onDismiss() (== context.
        // onOpenChange(false)) sempre que a tecla é Escape e nenhum
        // onEscapeKeyDown a tiver prevenido -- e AlertDialogContent só
        // previne onPointerDownOutside/onInteractOutside, nunca Escape.
        // Sem esta guarda, Escape fecharia o diálogo controlado mesmo com
        // uma operação em andamento, ignorando a mesma proteção que já
        // existe para "Cancelar". Só se aplica quando controlledClose=true
        // E busy=true -- os 9 consumidores que não passam controlledClose
        // continuam fechando com Escape exatamente como antes.
        if (controlledClose && busy) return;
        onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.dialogBackdrop} />
        <div className={styles.dialogPositioner}>
          <AlertDialog.Content className={styles.dialog}>
            <AlertDialog.Title className={styles.dialogTitle}>
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogBody}>
              {description}
            </AlertDialog.Description>
            {error ? (
              <p
                role="alert"
                style={{ color: "var(--potala-danger, #c95c57)", marginTop: 8 }}
              >
                {error}
              </p>
            ) : null}
            <div className={styles.dialogActions}>
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={controlledClose && busy}
                  onClick={onClose}
                >
                  Cancelar
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={busy}
                  onClick={(event) => {
                    if (controlledClose) {
                      // Suprime o fechamento automático do Radix -- só o
                      // consumidor (via onClose/estado "pendente") decide
                      // quando este diálogo realmente fecha.
                      event.preventDefault();
                    }
                    onConfirm();
                  }}
                >
                  {confirmLabel}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function AdminDrawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.button
                type="button"
                className={styles.drawerBackdrop}
                aria-label="Fechar painel"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-labelledby={titleId}>
              <motion.aside
                className={styles.drawer}
                initial={reduceMotion ? false : { x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { x: 24, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className={styles.header}>
                  <Dialog.Title id={titleId} className={styles.panelTitle}>
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      ref={closeRef}
                      type="button"
                      className={styles.btnGhost}
                      onClick={onClose}
                    >
                      Fechar
                    </button>
                  </Dialog.Close>
                </div>
                {children}
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
