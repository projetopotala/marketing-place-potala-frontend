"use client";

import { useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api/client';
import { getAnalyticsContext } from '@/lib/analytics';

export default function ContactPage() {
  const key=useRef<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [protocol,setProtocol]=useState('');
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const data=new FormData(event.currentTarget);key.current??=crypto.randomUUID();setBusy(true);setError('');
    try {
      const response=await apiFetch<{accepted:boolean;protocol:string}>('/public/contact',{method:'POST',body:JSON.stringify({id:key.current,name:data.get('name'),email:data.get('email'),subject:data.get('subject'),message:data.get('message'),company:data.get('company'),...getAnalyticsContext()})});
      if(!response?.accepted)throw new Error('Não foi possível confirmar o recebimento.');
      setProtocol(response.protocol);
    } catch(error) {setError(error instanceof Error?error.message:'Não foi possível enviar. Tente novamente.');}
    finally {setBusy(false);}
  }
  return <section className="mx-auto max-w-2xl px-6 py-12">
    <h1 className="font-display text-3xl">Fale com o Potala</h1>
    <p className="my-4">Sua mensagem será registrada para atendimento. Usaremos seu nome e e-mail para responder. Não envie senhas, dados bancários ou informações sensíveis.</p>
    {protocol?<div role="status"><h2 className="text-xl">Mensagem recebida</h2><p>Protocolo: {protocol}</p><p>O recebimento não significa que a solicitação já foi resolvida.</p></div>:<form className="grid gap-4" onSubmit={submit} onChange={()=>{key.current=null;}}>
      <label>Nome<input className="potala-input" name="name" autoComplete="name" required minLength={2} maxLength={120}/></label>
      <label>E-mail<input className="potala-input" name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Assunto<input className="potala-input" name="subject" required minLength={3} maxLength={160}/></label>
      <label>Mensagem<textarea className="potala-input" name="message" rows={6} required minLength={10} maxLength={5000}/></label>
      <div aria-hidden="true" className="hidden"><label>Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
      {error&&<p role="alert">{error}</p>}
      <button className="potala-btn potala-btn-primary" disabled={busy}>{busy?'Enviando…':'Enviar mensagem'}</button>
    </form>}
  </section>;
}
