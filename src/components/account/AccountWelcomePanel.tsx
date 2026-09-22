import { formatPrice } from "@/data/marketplace";
import styles from "./AccountWelcomePanel.module.css";

interface AccountWelcomePanelProps {
  name: string;
  /**
   * Resolvidas em page.tsx a partir de dado real (GET /customers/me pro
   * `memberSince`, GET /orders pro `totalOrders`/`totalSpent`) com
   * fallback pro mock antigo (`ACCOUNT_WELCOME_STATS`) enquanto carrega ou
   * se a chamada falhar — a lógica de fallback fica toda no caller agora,
   * este componente só exibe o que recebe.
   */
  memberSince: string;
  totalOrders: string;
  totalSpent: number;
}

export function AccountWelcomePanel({
  name,
  memberSince,
  totalOrders,
  totalSpent,
}: AccountWelcomePanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="welcome-title">
      <div>
        <h2 id="welcome-title" className={styles.title}>
          Bem-vindo(a), {name}
        </h2>
        <p className={styles.text}>
          Que sua jornada continue com presença, clareza e escolhas conscientes.
          Este painel reúne um resumo da sua conta no Instituto Potala
          Marketplace.
        </p>
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>Cliente desde</dt>
          <dd>{memberSince}</dd>
        </div>
        <div>
          <dt>Total de pedidos</dt>
          <dd>{totalOrders}</dd>
        </div>
        <div>
          <dt>Total gasto</dt>
          <dd>{formatPrice(totalSpent)}</dd>
        </div>
      </dl>
    </section>
  );
}
