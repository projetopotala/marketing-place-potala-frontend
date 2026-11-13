import { AccountChrome } from "@/components/account/AccountChrome";
import { NotificationsInbox } from "@/components/account/NotificationsInbox";
export default function Page() {
  return (
    <AccountChrome
      title="Notificações"
      lead="Acompanhe as atualizações da sua conta."
      breadcrumbCurrent="Notificações"
    >
      <NotificationsInbox />
    </AccountChrome>
  );
}
