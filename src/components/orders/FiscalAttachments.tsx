"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/api/config';
type FileRow = {id: string; fileName: string; mediaType: string};
export function FiscalAttachments({sellerOrderId, mode}: {sellerOrderId: string; mode: 'seller' | 'customer' | 'admin'}) {
  const base = mode === 'seller' ? `/seller/orders/${sellerOrderId}/fiscal-attachments` : `${mode === 'admin' ? '/admin' : ''}/orders/seller-orders/${sellerOrderId}/fiscal-attachments`;
  const [files, setFiles] = useState<FileRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {let active = true; apiFetch<FileRow[]>(base).then(v => {if (active) setFiles(v ?? []);}).catch(e => {if (active) setMessage(e.message);}); return () => {active = false;};}, [base]);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/\.(pdf|xml)$/i.test(file.name)) {setMessage('Envie PDF ou XML de até 5 MiB.'); return;}
    setBusy(true); setMessage('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);});
      const row = await apiFetch<FileRow>(base, {method: 'POST', body: JSON.stringify({fileName: file.name, mediaType: file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/xml', base64})});
      if (row) setFiles(previous => [...previous, row]);
      setMessage('Arquivo privado anexado.');
    } catch(e) {setMessage(e instanceof Error ? e.message : 'Falha ao anexar');} finally {setBusy(false);}
  }
  async function revoke(id: string) {setBusy(true); try {await apiFetch(`${base}/${id}`, {method: 'DELETE'}); setFiles(previous => previous.filter(f => f.id !== id));} catch(e) {setMessage(e instanceof Error ? e.message : 'Falha ao revogar');} finally {setBusy(false);}}
  return <section aria-label="Documentos fiscais e comprovantes"><h3>Documentos fiscais e comprovantes</h3>
    <p>Arquivos privados vinculados a esta loja e pedido. Anexar um documento não emite nota fiscal.</p>
    {mode === 'seller' && <label>Anexar PDF/XML (até 5 MiB)<input type="file" accept=".pdf,.xml" disabled={busy} onChange={e => {void upload(e.target.files?.[0]); e.target.value = '';}}/></label>}
    <ul>{files.map(file => <li key={file.id}><a href={`${API_BASE_URL}${base}/${file.id}`}>{file.fileName}</a> {mode !== 'customer' && <button type="button" disabled={busy} onClick={() => void revoke(file.id)}>Revogar acesso</button>}</li>)}</ul>
    <p role="status">{message || (!files.length ? 'Nenhum documento anexado.' : '')}</p>
  </section>;
}
