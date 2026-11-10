"use client";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";


import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { AccountDataProvider } from "@/features/account/AccountDataContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <AccountDataProvider>{children}<AnalyticsProvider /></AccountDataProvider>
      </CartProvider>
    </AuthProvider>
  );
}
