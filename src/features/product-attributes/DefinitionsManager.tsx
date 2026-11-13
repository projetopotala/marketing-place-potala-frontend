"use client";
import { useState,type FormEvent } from 'react';
import { apiFetch } from '@/lib/api/client';
import { AttributeDefinition,ITEM_TYPES,ItemType,useDefinitions } from './AttributeFields';
export function DefinitionsManager(){
 const [type,setType]=useState<ItemType>('PHYSICAL'),[revision,refresh]=useState(0),[editing,setEditing]=useState<AttributeDefinition|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const schema=useDefinitions(type,true,revision);
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setMessage('');const form=new FormData(event.currentTarget);
  try{await apiFetch('/admin/product-attributes',{method:'PUT',body:JSON.stringify({itemType:type,key:form.get('key'),label:form.get('label'),kind:form.get('kind'),options:String(form.get('options')??'').split('\n').map(value=>value.trim()).filter(Boolean),active:form.get('active')==='on'})});setEditing(null);refresh(value=>value+1);setMessage('Definição salva.');}catch(error){setError(error instanceof Error?error.message:'Falha ao salvar.');}finally{setBusy(false);}}
 return <section className="my-6 rounded border border-potala-border p-4"><h2>Atributos por tipo de item</h2><p>Até dez definições ativas por tipo. As escolhas e os valores são validados no servidor.</p>
  <label>Tipo<select className="potala-input" value={type} onChange={event=>{setType(event.target.value as ItemType);setEditing(null);}}>{Object.entries(ITEM_TYPES).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  {(error||schema.error)&&<p role="alert">{error||schema.error}</p>}{message&&<p role="status">{message}</p>}
  <ul>{schema.items.map(def=><li key={def.id}>{def.label} ({def.key}, {def.kind}) — {def.active?'ativo':'inativo'} <button type="button" className="underline" onClick={()=>setEditing(def)}>Editar</button></li>)}</ul>
  <form className="my-4 grid gap-3" key={editing?.id??type+revision} onSubmit={save}><fieldset className="grid gap-3" disabled={busy||schema.loading}>
   <legend>{editing?'Editar definição':'Nova definição'}</legend>
   <label>Identificador<input className="potala-input" name="key" required pattern="[a-z][a-z0-9_]{0,39}" maxLength={40} readOnly={!!editing} defaultValue={editing?.key}/></label>
   <label>Nome apresentado<input className="potala-input" name="label" required maxLength={80} defaultValue={editing?.label}/></label>
   <label>Formato<select className="potala-input" name="kind" defaultValue={editing?.kind??'TEXT'}><option value="TEXT">Texto</option><option value="NUMBER">Número</option><option value="BOOLEAN">Sim/não</option><option value="CHOICE">Escolha da lista</option></select></label>
   <label>Escolhas, uma por linha; deixe vazio para os demais formatos<textarea className="potala-input" name="options" defaultValue={editing?.options.join('\n')}/></label>
   <label><input name="active" type="checkbox" defaultChecked={editing?.active??true}/> Ativo</label><button className="potala-btn" disabled={busy}>Salvar definição</button>
  </fieldset></form>
  {editing&&<button onClick={()=>setEditing(null)}>Cancelar edição</button>}
 </section>;
}
