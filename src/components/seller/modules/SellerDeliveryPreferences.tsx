"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
type Rate = {state: string; postalCodeFrom?: string; postalCodeTo?: string; priceCents: number; estimatedDays: number};
type Settings = {pickupEnabled: boolean; pickupAddress?: string | null; deliveryEnabled: boolean; rates: Rate[]};
export function SellerDeliveryPreferences() {
  const [value, setValue] = useState<Settings>({pickupEnabled: false, pickupAddress: '', deliveryEnabled: false, rates: []});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => { let active = true; apiFetch<Settings>('/seller/settings/delivery').then(v => { if (v && active) setValue(v); }).catch(e => {if (active) setMessage(e.message);}).finally(() => {if (active) setBusy(false);}); return () => {active = false;}; }, []);
  async function save() {
    setBusy(true); setMessage('');
    try { await apiFetch('/seller/settings/delivery', {method: 'PUT', body: JSON.stringify({...value, pickupAddress: value.pickupAddress ?? ''})}); setMessage('Preferências de entrega salvas.'); } catch(e) {setMessage(e instanceof Error ? e.message : 'Falha ao salvar');} finally {setBusy(false);}
  }
  function rate(index: number, patch: Partial<Rate>) {setValue(v => ({...v, rates: v.rates.map((r, i) => i === index ? {...r, ...patch} : r)}));}
  return <section aria-label="Entrega e retirada"><h3>Entrega e retirada</h3>
    <label><input type="checkbox" checked={value.pickupEnabled} onChange={e => setValue({...value, pickupEnabled: e.target.checked})}/> Permitir retirada gratuita</label>
    <label>Endereço e instruções para retirada<input maxLength={500} value={value.pickupAddress ?? ''} onChange={e => setValue({...value, pickupAddress: e.target.value})}/></label>
    <label><input type="checkbox" checked={value.deliveryEnabled} onChange={e => setValue({...value, deliveryEnabled: e.target.checked})}/> Oferecer entrega própria</label>
    <p>Cadastre valores em centavos. Zero oferece frete grátis explicitamente. CEP inicial e final são opcionais, com oito dígitos.</p>
    {value.rates.map((r, i) => <fieldset key={i}><legend>Região {i + 1}</legend>
      <label>UF<input maxLength={2} value={r.state} onChange={e => rate(i, {state: e.target.value.toUpperCase()})}/></label>
      <label>CEP inicial<input maxLength={8} value={r.postalCodeFrom ?? ''} onChange={e => rate(i, {postalCodeFrom: e.target.value || undefined})}/></label>
      <label>CEP final<input maxLength={8} value={r.postalCodeTo ?? ''} onChange={e => rate(i, {postalCodeTo: e.target.value || undefined})}/></label>
      <label>Preço em centavos<input type="number" min={0} step={1} value={r.priceCents} onChange={e => rate(i, {priceCents: Number(e.target.value)})}/></label>
      <label>Prazo em dias<input type="number" min={0} max={365} step={1} value={r.estimatedDays} onChange={e => rate(i, {estimatedDays: Number(e.target.value)})}/></label>
      <button type="button" onClick={() => setValue({...value, rates: value.rates.filter((_, n) => n !== i)})}>Remover região</button>
    </fieldset>)}
    <button type="button" disabled={value.rates.length >= 100} onClick={() => setValue({...value, rates: [...value.rates, {state: '', priceCents: 0, estimatedDays: 0}]})}>Adicionar região</button>
    <button type="button" disabled={busy} onClick={() => void save()}>Salvar entrega e retirada</button><p role="status">{message}</p>
    <p>Transportadora principal indisponível até aprovação e configuração da integração.</p>
  </section>;
}
