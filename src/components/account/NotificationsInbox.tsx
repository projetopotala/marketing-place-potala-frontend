"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
import styles from "./notifications.module.css";
type Notice = {
  id: string;
  title: string;
  message: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};
export function NotificationsInbox() {
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<Notice[]>("/notifications")
      .then((data) => setItems(data || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function read(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }
  return (
    <section className={styles.inbox} aria-label="Mensagens e notificações">
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? (
        <p>Carregando…</p>
      ) : (
        !items.length && <p>Nenhuma notificação.</p>
      )}
      {items.map((item) => (
        <article
          key={item.id}
          className={styles.card}
        >
          <span className={styles.badge}>{item.readAt ? "Lida" : "Nova mensagem"}</span>
          <h2>{item.title}</h2>
          <p>{item.message}</p>
          <Link className={styles.action} href={item.href}>Ver detalhes</Link>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString("pt-BR")}
          </time>
          {!item.readAt && (
            <button onClick={() => read(item.id)} className={styles.secondary}>
              Marcar como lida
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
