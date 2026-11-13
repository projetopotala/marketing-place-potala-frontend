"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
type Policy={configured:boolean;id?:string;title?:string;content?:string;version?:number;contentHash?:string};
export default function PolicyPage({policyKey,title}:{policyKey:string;title:string}) {
  const [policy,setPolicy]=useState<Policy|null>(null),[message,setMessage]=useState("");
  useEffect(()=>{let alive=true;apiFetch<Policy>(`/legal/policies/${policyKey}`).then(p=>{if(alive)setPolicy(p);}).catch(e=>{if(alive)setMessage(e.message);});return()=>{alive=false;};},[policyKey]);
  async function accept(){try{await apiFetch('/legal/acceptances',{method:'POST',body:JSON.stringify({policyId:policy?.id})});setMessage('Aceite registrado com a versão e data desta política.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível registrar o aceite.');}}
  return <main style={{maxWidth:850,margin:'40px auto',padding:24}}><h1>{policy?.title||title}</h1>{message&&<p role="status">{message}</p>}{!policy&&!message&&<p>Carregando…</p>}{policy&&!policy.configured&&<p>Este documento aguarda configuração e publicação pela administração. Não há texto aprovado disponível.</p>}{policy?.configured&&<><p>Versão {policy.version}</p><div style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{policy.content}</div><button onClick={accept}>Li e aceito esta versão (requer entrar na conta)</button></>}</main>;
}
