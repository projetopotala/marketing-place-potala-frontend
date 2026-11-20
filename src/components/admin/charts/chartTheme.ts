import { POTALA_TOKENS } from "@/styles/tokens";

export const ADMIN_CHART_COLORS = {
  gold: "var(--admin-gold)",
  goldLight: "var(--admin-gold)",
  blue: POTALA_TOKENS.info,
  green: POTALA_TOKENS.success,
  red: POTALA_TOKENS.danger,
  purple: POTALA_TOKENS.purple,
  orange: POTALA_TOKENS.orange,
  grid: "var(--admin-border)",
  text: "var(--admin-muted)",
  surface: "var(--admin-surface)",
  elevated: "var(--admin-elevated)",
  border: "var(--admin-border)",
  ink: "var(--admin-text)",
} as const;

export const ADMIN_CHART_SERIES = [
  ADMIN_CHART_COLORS.gold,
  ADMIN_CHART_COLORS.blue,
  ADMIN_CHART_COLORS.green,
  ADMIN_CHART_COLORS.purple,
  ADMIN_CHART_COLORS.orange,
  ADMIN_CHART_COLORS.red,
  ADMIN_CHART_COLORS.goldLight,
] as const;

export const CHART_ANIMATION_MS = 280;
