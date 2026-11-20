import { Suspense } from "react";
import { ANNOUNCEMENT_TEXT } from "@/data/marketplace";
import { TruckIcon } from "@/components/storefront/icons";
import { getStorefrontSettings } from "@/lib/storefront-settings";

function AnnouncementBarView({ text }: { text: string }) {
  return (
    <div className="potala-announcement border-b border-potala-border bg-potala-bg-secondary text-potala-text">
      <div className="potala-container relative flex h-10 items-center justify-center md:h-[2.55rem]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 hidden h-2 w-2 rotate-45 border border-potala-gold/70 md:block"
        />
        <p className="flex max-w-[min(100%,42rem)] items-center justify-center gap-2.5 px-8 text-center text-[0.8rem] leading-snug md:text-[0.875rem]">
          <TruckIcon className="h-4 w-4 shrink-0 text-potala-gold-light" />
          <span>{text}</span>
        </p>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 hidden h-2 w-2 rotate-45 border border-potala-gold/70 md:block"
        />
      </div>
    </div>
  );
}

/**
 * Aviso configurado em Admin → Configurações (catalog-service). Desativado
 * pelo admin = barra oculta. Texto não configurado, ou leitura indisponível,
 * = texto padrão de `data/marketplace.ts` (comportamento anterior).
 */
async function ConfiguredAnnouncementBar() {
  const settings = await getStorefrontSettings();
  if (settings && !settings.announcementEnabled) return null;
  return <AnnouncementBarView text={settings?.announcementText ?? ANNOUNCEMENT_TEXT} />;
}

export function AnnouncementBar() {
  return (
    <Suspense fallback={<AnnouncementBarView text={ANNOUNCEMENT_TEXT} />}>
      <ConfiguredAnnouncementBar />
    </Suspense>
  );
}
