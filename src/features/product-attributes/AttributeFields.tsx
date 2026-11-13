"use client";
import { useEffect,useState } from 'react';
import { apiFetch } from '@/lib/api/client';
export const ITEM_TYPES={PHYSICAL:'Produto físico',DIGITAL:'Produto digital',SERVICE:'Serviço',COURSE:'Curso'} as const;
export type ItemType=keyof typeof ITEM_TYPES;
export interface AttributeDefinition {id:string;itemType:ItemType;key:string;label:string;kind:'TEXT'|'NUMBER'|'BOOLEAN'|'CHOICE';options:string[];active:boolean}
export function useDefinitions(type:ItemType,admin=false,revision=0){
  const [data,setData]=useState<{type:ItemType;items:AttributeDefinition[]}|null>(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;apiFetch<AttributeDefinition[]>(`/${admin?'admin':'public'}/product-attributes?itemType=${type}`)
    .then(items=>{if(live){setData({type,items:items??[]});setError('');}}).catch(error=>{if(live)setError(error instanceof Error?error.message:'Falha nos atributos.');});return()=>{live=false;};},[type,admin,revision]);
  return {items:data?.type===type?data.items:[],loading:data?.type!==type,error};
}
export function AttributeFields({definitions,values={}}:{definitions:AttributeDefinition[];values?:Record<string,unknown>}){
 return <>{definitions.map(def=><label className="grid gap-1" key={def.key}>{def.label}
  {def.kind==='BOOLEAN'?<select className="potala-input" name={'attr_'+def.key} defaultValue={values[def.key]===undefined?'':String(values[def.key])}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select>:
  def.kind==='CHOICE'?<select className="potala-input" name={'attr_'+def.key} defaultValue={String(values[def.key]??'')}><option value="">Não informado</option>{def.options.map(option=><option key={option}>{option}</option>)}</select>:
  <input className="potala-input" name={'attr_'+def.key} type={def.kind==='NUMBER'?'number':'text'} step={def.kind==='NUMBER'?'any':undefined} maxLength={200} defaultValue={String(values[def.key]??'')} />}
 </label>)}</>;
}
export function collectAttributes(form:FormData,definitions:AttributeDefinition[]){
 const attributes:Record<string,string|number|boolean>={};
 for(const def of definitions){const raw=String(form.get('attr_'+def.key)??'').trim();if(!raw)continue;attributes[def.key]=def.kind==='BOOLEAN'?raw==='true':def.kind==='NUMBER'?Number(raw):raw;}
 return attributes;
}
