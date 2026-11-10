'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { getSellerPaymentPreferences, updateSellerPaymentPreferences, type SellerPaymentPreferences as Preferences } from '@/lib/api/sellers';
import styles from '@/components/seller/seller.module.css';

export function SellerPaymentPreferences() {
  const [value, setValue] = useState<Preferences | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { let active = true; getSellerPaymentPreferences().then(v => { if (active) setValue(v); }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Não foi possível carregar recebimentos.'); }); return () => { active = false; }; }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!value) return;
    setSaving(true); setMessage('');
    try { setValue(await updateSellerPaymentPreferences({acceptPix: value.acceptPix, acceptCard: value.acceptCard, payoutSchedule: value.payoutSchedule})); setMessage('Preferências salvas. Gateway ainda indisponível.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  }
  return <section className={styles.panel}>
    <h2 className={styles.panelTitle}>Recebimentos e meios de pagamento</h2>
    <p>Gateway não configurado. Estas preferências não ativam cobranças nem repasses. O cadastro do recebedor será concluído no provedor escolhido.</p>
    <p>Não informe número de cartão, CVV, chave Pix ou dados completos de conta.</p>
    {value && <form onSubmit={save} className={styles.formGrid}>
      <label><input type="checkbox" checked={value.acceptPix} onChange={e => setValue({...value, acceptPix: e.target.checked})} /> Aceitar Pix quando disponível</label>
      <label><input type="checkbox" checked={value.acceptCard} onChange={e => setValue({...value, acceptCard: e.target.checked})} /> Aceitar cartão quando disponível</label>
      <label>Preferência de repasse <select value={value.payoutSchedule} onChange={e => setValue({...value, payoutSchedule: e.target.value as Preferences['payoutSchedule']})}>
        <option value="MANUAL">Manual</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option>
      </select></label>
      <p>Recebedor: {value.recipientConfigured ? 'Referência cadastrada no provedor' : 'Pendente de integração'}{value.accountLast4 ? ` · ${value.bankLabel ?? 'Conta'} final ${value.accountLast4}` : ''}</p>
      <button className={styles.primaryBtn} disabled={saving}>{saving ? 'Salvando…' : 'Salvar preferências'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
