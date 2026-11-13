"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import Link from "next/link";
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
    <section>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Carregando…</p>
      ) : (
        !items.length && <p>Nenhuma notificação.</p>
      )}
      {items.map((item) => (
        <article
          key={item.id}
          style={{ padding: 16, borderBottom: "1px solid #ddd" }}
        >
          <h2>{item.title}</h2>
          <p>{item.message}</p>
          <Link href={item.href}>Consultar na minha conta</Link>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString("pt-BR")}
          </time>
          {!item.readAt && (
            <button onClick={() => read(item.id)} style={{ marginLeft: 16 }}>
              Marcar como lida
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
