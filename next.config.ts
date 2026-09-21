import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
