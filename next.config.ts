import type { NextConfig } from "next";
import path from "path";
import legacyRedirects from "./legacy-redirects.json";

const nextConfig: NextConfig = {
  redirects() {
    const sources = new Set<string>();
    for (const entry of legacyRedirects) {
      const literalPath = /^\/[a-zA-Z0-9/_-]*$/;
      if (!literalPath.test(entry.source) || !literalPath.test(entry.destination)
        || entry.source.startsWith('//') || entry.destination.startsWith('//')
        || entry.source === entry.destination || sources.has(entry.source) || entry.statusCode !== 301) {
        throw new Error('Invalid legacy redirect mapping');
      }
      sources.add(entry.source);
    }
    if (legacyRedirects.some(entry => sources.has(entry.destination))) throw new Error('Redirect chains are not allowed');
    return legacyRedirects.map(entry => ({ ...entry, statusCode: 301 as const }));
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Produtos reais têm imagens em URLs arbitrárias coladas pelo vendedor
    // (sem endpoint de upload — ver products.constants.ts no catalog-service),
    // hospedadas em domínios desconhecidos até o momento do cadastro. Sem
    // isso, o otimizador de imagem do Next rejeita qualquer host não
    // listado em remotePatterns/domains ("hostname is not configured"),
    // o que quebraria toda imagem real da vitrine pública. unoptimized
    // também evita o Next re-buscar/reprocessar imagens de hosts externos
    // arbitrários no servidor (CORS, hotlink protection, etc.).
    unoptimized: true,
  },
  turbopack: {
    // Absolute project root — avoids resolving the lockfile in C:\Users\vicel
    root: path.join(__dirname),
  },
};

export default nextConfig;
