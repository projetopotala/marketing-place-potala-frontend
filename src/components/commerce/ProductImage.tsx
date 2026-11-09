"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function ProductImage({ src, alt, className = "", ...props }: ImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === String(src);

  return (
    <Image
      {...props}
      src={failed ? "/images/potala/product-unavailable.svg" : src}
      alt={failed ? `${alt} — imagem indisponível` : alt}
      className={failed ? `${className} !object-contain bg-[#efdfbf]` : className}
      onError={() => setFailedSource(String(src))}
    />
  );
}
