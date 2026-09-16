"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AccessMode } from "@/types/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SellerRegisterForm } from "@/components/auth/SellerRegisterForm";
import styles from "./AccessForm.module.css";

function resolveMode(value: string | null): AccessMode {
  if (value === "cadastro") return "register";
  if (value === "cadastro-vendedor") return "register-seller";
  return "login";
}

function modeQuery(mode: AccessMode): string | null {
  if (mode === "register") return "cadastro";
  if (mode === "register-seller") return "cadastro-vendedor";
  return null;
}

export function AccessForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = resolveMode(searchParams.get("modo"));
  const [prefillEmail, setPrefillEmail] = useState("");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    shellRef.current?.setAttribute("data-access-hydrated", "true");
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("access-title")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  function goToMode(next: AccessMode) {
    const query = modeQuery(next);
    const href = query ? `${pathname}?modo=${query}` : pathname;
    router.replace(href, { scroll: false });
  }

  function handleBackToLogin(email: string, message: string | null = null) {
    setPrefillEmail(email);
    setBannerMessage(message);
    goToMode("login");
  }

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      data-access-hydrated="false"
    >
      <AnimatePresence mode="wait">
        <motion.div
          className={`${styles.card} ${mode !== "login" ? styles.register : ""}`}
          key={mode}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {mode === "login" ? (
            <LoginForm
              key={`login-${prefillEmail}-${bannerMessage ?? "none"}`}
              initialEmail={prefillEmail}
              bannerMessage={bannerMessage}
              onCreateAccount={() => {
                setBannerMessage(null);
                goToMode("register");
              }}
              onCreateSellerAccount={() => {
                setBannerMessage(null);
                goToMode("register-seller");
              }}
            />
          ) : mode === "register" ? (
            <RegisterForm onBackToLogin={handleBackToLogin} />
          ) : (
            <SellerRegisterForm onBackToLogin={handleBackToLogin} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
