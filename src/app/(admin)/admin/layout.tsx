import type { ReactNode } from "react";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminToastProvider } from "@/components/admin/shared/AdminToastProvider";

export const metadata = {
  title: "Painel Administrativo | Instituto Potala Marketplace",
  description:
    "Visão geral e controle completo do ecossistema espiritual do Instituto Potala.",
};

/**
 * Layout administrativo independente do storefront.
 * Sessão autenticada; as telas consultam as APIs administrativas.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
        <AdminToastProvider>
          <AdminShell>{children}</AdminShell>
        </AdminToastProvider>
    </AdminAuthGuard>
  );
}
