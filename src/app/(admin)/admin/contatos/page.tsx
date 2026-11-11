"use client";
import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader';
interface Contact {id:string;name:string;email?:string;subject:string;message?:string;status:string;createdAt:string}
export default function ContactsPage() {
  const [items,setItems]=useState<Contact[]>([]),[selected,setSelected]=useState<Contact|null>(null),[cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function load(more=false) {
    setBusy(true);setError('');
    try {const data=await apiFetch<{items:Contact[];nextCursor:string|null}>(`/admin/contacts${more&&cursor?'?cursor='+encodeURIComponent(cursor):''}`,{cache:'no-store'});setItems(old=>more?[...old,...(data?.items??[])]:data?.items??[]);setCursor(data?.nextCursor??null);setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar.');}finally{setBusy(false);}
  }
  async function open(id:string) {setError('');try{setSelected(await apiFetch<Contact>(`/admin/contacts/${id}`,{cache:'no-store'}));}catch(e){setError(e instanceof Error?e.message:'Falha ao abrir.');}}
  async function status(value:string) {if(!selected)return;setBusy(true);try {await apiFetch(`/admin/contacts/${selected.id}`,{method:'PATCH',body:JSON.stringify({status:value})});setSelected({...selected,status:value});setItems(old=>old.map(item=>item.id===selected.id?{...item,status:value}:item));}catch(e){setError(e instanceof Error?e.message:'Falha ao atualizar.');}finally{setBusy(false);}}
  return <div><AdminPageHeader title="Mensagens de contato" description="Solicitações recebidas pelo formulário. Acesso restrito ao atendimento global."/>
    <button className="potala-btn" disabled={busy} onClick={()=>void load()}>Consultar mensagens</button>
    {error&&<p role="alert">{error}</p>}{loaded&&!items.length&&<p>Nenhuma mensagem registrada.</p>}
    <ul className="my-4 grid gap-3">{items.map(item=><li key={item.id} className="rounded border border-potala-border p-3"><button className="underline" onClick={()=>void open(item.id)}>{item.subject}</button><p>{item.name} · {item.status} · {new Date(item.createdAt).toLocaleString('pt-BR')}</p></li>)}</ul>
    {cursor&&<button disabled={busy} onClick={()=>void load(true)}>Carregar mais</button>}
    {selected&&<section className="rounded border border-potala-border p-4" aria-label="Mensagem selecionada"><h2>{selected.subject}</h2><p>{selected.name} · {selected.email}</p><p>Protocolo: {selected.id}</p><p className="my-4 whitespace-pre-wrap">{selected.message}</p><div className="flex gap-3"><button disabled={busy} onClick={()=>void status('READ')}>Marcar como lida</button><button disabled={busy} onClick={()=>void status('CLOSED')}>Encerrar</button></div></section>}
  </div>;
}
