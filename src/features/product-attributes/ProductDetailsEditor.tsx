"use client";
import { useState,type FormEvent } from 'react';
import { apiFetch } from '@/lib/api/client';
import { SellerProduct } from '@/lib/api/catalog';
import { AttributeFields,collectAttributes,ITEM_TYPES,ItemType,useDefinitions } from './AttributeFields';
export function ProductDetailsEditor({product,onSaved}:{product:SellerProduct;onSaved:(value:SellerProduct)=>void}){
 const [type,setType]=useState<ItemType>(product.itemType??'PHYSICAL'),[busy,setBusy]=useState(false),[error,setError]=useState('');const schema=useDefinitions(type);
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try{
  const saved=await apiFetch<SellerProduct>(`/seller/products/${product.id}/details`,{method:'PATCH',body:JSON.stringify({title:form.get('title'),description:form.get('description'),priceCents:Number(form.get('priceCents')),itemType:type,attributes:collectAttributes(form,schema.items),imageUrls:String(form.get('images')??'').split('\n').map(value=>value.trim()).filter(Boolean)})});if(saved)onSaved(saved);
 }catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 return <details className="my-5 rounded border border-potala-border p-4"><summary>Editar produto e atributos</summary><form className="my-4 grid gap-3" onSubmit={save}><fieldset className="grid gap-3" disabled={busy||schema.loading}>
  <legend>Informações do produto</legend><label>Título<input name="title" className="potala-input" defaultValue={product.title} required maxLength={160}/></label>
  <label>Descrição<textarea name="description" className="potala-input" defaultValue={product.description} maxLength={5000}/></label>
  <label>Preço em centavos<input name="priceCents" className="potala-input" type="number" min={0} max={100000000} required defaultValue={product.priceCents}/></label>
  <label>Imagens HTTPS, uma por linha; até seis<textarea name="images" className="potala-input" defaultValue={product.images?.map(image=>image.url).join('\n')??''}/></label>
  <label>Tipo de item<select className="potala-input" value={type} onChange={event=>setType(event.target.value as ItemType)}>{Object.entries(ITEM_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <div className="grid gap-3" key={type}><AttributeFields definitions={schema.items} values={type===(product.itemType??'PHYSICAL')?product.attributes:{}}/></div>
  {error||schema.error?<p role="alert">{error||schema.error}</p>:null}<button className="potala-btn" disabled={busy||!!schema.error}>Salvar alterações</button>
 </fieldset></form><p>Alterar tipo não cria automaticamente uma inscrição de curso ou entrega de arquivo digital.</p></details>;
}
