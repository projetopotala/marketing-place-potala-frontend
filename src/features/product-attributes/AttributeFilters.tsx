"use client";
import { useState,type FormEvent } from 'react';
import { usePathname,useRouter,useSearchParams } from 'next/navigation';
import { AttributeFields,collectAttributes,ITEM_TYPES,ItemType,useDefinitions } from './AttributeFields';
export function AttributeFilters(){const params=useSearchParams();return <FilterForm key={params.toString()}/>;}
function FilterForm(){
 const params=useSearchParams(),router=useRouter(),pathname=usePathname();const originalType=params.get('tipo')??'PHYSICAL';
 const [type,setType]=useState<ItemType>(Object.hasOwn(ITEM_TYPES,originalType)?originalType as ItemType:'PHYSICAL');const schema=useDefinitions(type);
 let values:Record<string,unknown>={};try{const input=JSON.parse(params.get('atributos')??'{}');if(input&&!Array.isArray(input)&&typeof input==='object')values=input;}catch{}
 function apply(event:FormEvent<HTMLFormElement>){event.preventDefault();const next=new URLSearchParams(params.toString()),attributes=collectAttributes(new FormData(event.currentTarget),schema.items);next.set('tipo',type);if(Object.keys(attributes).length)next.set('atributos',JSON.stringify(attributes));else next.delete('atributos');router.push(pathname+'?'+next);}
 return <details className="my-4 rounded border border-potala-border p-4"><summary>Filtrar por tipo e atributos</summary><form className="my-3 grid gap-3" onSubmit={apply}>
  <label>Tipo<select className="potala-input" value={type} onChange={event=>setType(event.target.value as ItemType)}>{Object.entries(ITEM_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <div key={type} className="grid gap-3 sm:grid-cols-2"><AttributeFields definitions={schema.items} values={type===originalType?values:{}}/></div>
  {schema.error&&<p role="alert">{schema.error}</p>}<button className="potala-btn" disabled={schema.loading||!!schema.error}>Aplicar atributos</button>
 </form></details>;
}
