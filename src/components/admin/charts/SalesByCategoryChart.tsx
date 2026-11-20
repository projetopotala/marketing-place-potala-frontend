"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/features/admin/utils/currency";
import { AdminChartContainer } from "./AdminChartContainer";
import { AdminChartTooltip } from "./AdminChartTooltip";
import { ADMIN_CHART_SERIES, CHART_ANIMATION_MS } from "./chartTheme";
import styles from "./charts.module.css";

interface CategoryPoint {
  id: string;
  label: string;
  value: number;
  color?: string;
}

interface SalesByCategoryChartProps {
  data: CategoryPoint[];
}

export function SalesByCategoryChart({ data }: SalesByCategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.map((item, index) => ({
    name: item.label,
    value: item.value,
    color: item.color ?? ADMIN_CHART_SERIES[index % ADMIN_CHART_SERIES.length],
  }));

  if (chartData.length === 0) {
    return <div className={styles.empty}>Sem vendas por categoria no período.</div>;
  }

  return (
    <div className={styles.categoryChart}>
    <AdminChartContainer
      title="Vendas por categoria"
      description="Distribuição de receita por categoria de produto."
      summary={`Total ${formatMoney(total)} distribuído em ${chartData.length} categorias.`}
      compact
    >
      <div className={styles.legendSide}>
        <div className={styles.donutWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="78%"
                paddingAngle={2}
                stroke="transparent"
                animationDuration={CHART_ANIMATION_MS}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<AdminChartTooltip moneyKeys={["value"]} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.donutCenter} aria-hidden="true">
            <div>
              <span className={styles.donutCenterLabel}>Total</span>
              <span className={styles.donutCenterValue}>{formatMoney(total)}</span>
            </div>
          </div>
        </div>
        <ul className={styles.legendList}>
          {chartData.map((item) => (
            <li key={item.name} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: item.color }}
                aria-hidden="true"
              />
              <span className={styles.legendName}>{item.name}</span>
              <span className={styles.legendValue}>{formatMoney(item.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </AdminChartContainer>
    </div>
  );
}
