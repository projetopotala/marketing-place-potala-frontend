'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { createFinancialPolicy, listFinancialPolicies, type FinancialPolicy } from '@/lib/api/orders';

export function FinancialPolicies() {
  const [policies, setPolicies] = useState<FinancialPolicy[]>([]);
  const [scope, setScope] = useState<FinancialPolicy['scope']>('PLATFORM');
  const [scopeId, setScopeId] = useState('');
  const [commission, setCommission] = useState('');
  const [fee, setFee] = useState('');
  const [fixed, setFixed] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { let active = true; listFinancialPolicies().then(p => { if (active) setPolicies(p); }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Falha ao carregar políticas.'); }); return () => { active = false; }; }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await createFinancialPolicy({scope, ...(scope === 'PLATFORM' ? {} : {scopeId}), commissionBps: Number(commission), gatewayFeeBps: Number(fee), fixedFeeCents: Number(fixed)});
      setPolicies(await listFinancialPolicies()); setMessage('Nova versão aprovada para os próximos pedidos.');
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  }
  return <section style={{padding: 24, border: '1px solid var(--potala-border, #ddd)', borderRadius: 12, marginBlock: 24}}>
    <h2>Políticas de comissão e taxas</h2>
    <p>Sem valores comerciais presumidos. Cada gravação aprova uma nova versão. Prioridade: produto, categoria, vendedor, plataforma. Taxa fixa por linha do pedido; percentuais sobre o valor após desconto.</p>
    <form onSubmit={save} style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end'}}>
      <label>Escopo <select value={scope} onChange={e => setScope(e.target.value as FinancialPolicy['scope'])}><option value="PLATFORM">Plataforma</option><option value="SELLER">Vendedor</option><option value="CATEGORY">Categoria</option><option value="PRODUCT">Produto</option></select></label>
      {scope !== 'PLATFORM' && <label>ID do escopo <input required value={scopeId} onChange={e => setScopeId(e.target.value)} pattern="[a-fA-F0-9-]{36}" /></label>}
      <label>Comissão (bps; 100 = 1%) <input type="number" min="0" max="10000" step="1" required value={commission} onChange={e => setCommission(e.target.value)} /></label>
      <label>Taxa do gateway (bps) <input type="number" min="0" max="10000" step="1" required value={fee} onChange={e => setFee(e.target.value)} /></label>
      <label>Taxa fixa (centavos por linha) <input type="number" min="0" max="2147483647" step="1" required value={fixed} onChange={e => setFixed(e.target.value)} /></label>
      <button disabled={saving}>{saving ? 'Salvando…' : 'Aprovar nova versão'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <ul>{policies.slice(0, 20).map(p => <li key={p.id}>{p.scope} {p.scopeId ?? 'Geral'} · versão {p.version} · comissão {p.commissionBps} bps · gateway {p.gatewayFeeBps} bps + {p.fixedFeeCents} centavos/linha</li>)}</ul>
  </section>;
}
