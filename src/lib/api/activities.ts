import { apiFetch } from "./client";
import { getAnalyticsContext } from "@/lib/analytics";
export type ActivityKind = "COURSE" | "EVENT" | "RECURRING";
export interface ActivityPage<T> {
  items: T[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}
export interface ActivitySession {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  kind: ActivityKind;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  priceCents: number;
  capacity: number;
  timezone: string;
  enrollmentDeadline: string;
  sessions: ActivitySession[];
}
export interface Enrollment {
  id: string;
  activityId: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  priceCents: number;
  expiresAt: string | null;
  activity: Activity;
}
export interface Material {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
}
export const activityApi = {
  list: (kind?: ActivityKind, cursor?: string) =>
    apiFetch<ActivityPage<Activity>>(
      `/activities?limit=20${kind ? `&kind=${kind}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    ),
  get: (id: string) => apiFetch<Activity>(`/activities/${id}`),
  enroll: (id: string) =>
    apiFetch<Enrollment>(`/activities/${id}/enroll`, { method: "POST" }),
  mine: (cursor?: string) =>
    apiFetch<ActivityPage<Enrollment>>(
      `/me/enrollments?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    ),
  cancel: (id: string) =>
    apiFetch(`/me/enrollments/${id}/cancel`, { method: "POST" }),
  materials: (id: string) =>
    apiFetch<Material[]>(`/me/enrollments/${id}/materials`),
  pay: (id: string) =>
    apiFetch("/me/activity-payments", {
      method: "POST",
      body: JSON.stringify({ enrollmentId: id, ...getAnalyticsContext() }),
    }),
};
export function activityDate(date: string, zone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(date));
}
export function activityPrice(cents: number) {
  return cents === 0
    ? "Gratuito"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);
}
export const activityKindLabel = {
  COURSE: "Curso",
  EVENT: "Evento",
  RECURRING: "Atividade recorrente",
};
