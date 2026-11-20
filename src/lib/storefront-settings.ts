import { cache } from "react";
import { getPublicSettings } from "@/lib/api/settings";

/**
 * Uma única leitura de `/public/settings` por renderização, compartilhada
 * entre AnnouncementBar e MarketplaceFooter. Nunca lança (ver
 * getPublicSettings): `null` = usar os padrões da vitrine.
 */
export const getStorefrontSettings = cache(getPublicSettings);
