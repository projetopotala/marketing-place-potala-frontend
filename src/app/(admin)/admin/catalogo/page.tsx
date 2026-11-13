import { CatalogView } from "@/components/admin/modules/CatalogView";
import { DefinitionsManager } from '@/features/product-attributes/DefinitionsManager';

export default function AdminCatalogPage() {
  return <><CatalogView /><DefinitionsManager /></>;
}
