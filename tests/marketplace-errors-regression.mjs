// Loopback UI only; HTTP fixtures prevent real account changes or emails.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3100';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();let activityRequests=0;let pagination=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return route.fulfill({status:401,contentType:'application/json',body:'{"message":"Unauthorized"}'});
  if(path.endsWith('/activities')) {
   if(pagination){const more=new URL(route.request().url()).searchParams.has('cursor');const id=more?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111';return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{id,title:more?'Segundo evento local':'Primeiro evento local',kind:'EVENT',description:'Somente homologação',priceCents:0,sessions:[],timezone:'America/Sao_Paulo'}],pageInfo:{hasNextPage:!more,nextCursor:more?null:id}})});}
   activityRequests++;
   if(activityRequests===1)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Serviço temporariamente indisponível.","code":"DATABASE_SCHEMA_NOT_READY"}'});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],pageInfo:{hasNextPage:false,nextCursor:null}})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],pageInfo:{hasNextPage:false,nextCursor:null}})});
 });
 await page.goto(origin+'/cursos',{waitUntil:'domcontentloaded'});
 await expect(page.locator('main [role="alert"]')).toBeVisible();
 await expect(page.getByText('Nenhuma atividade publicada neste momento.')).toHaveCount(0);
 await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await expect(page.getByText('Nenhuma atividade publicada neste momento.')).toBeVisible();
 await expect(page.locator('main [role="alert"]')).toHaveCount(0);
 assert.equal(activityRequests,2);
 pagination=true;
 await page.goto(origin+'/eventos',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Primeiro evento local'})).toBeVisible();
 await page.getByRole('button',{name:'Carregar mais atividades'}).click();
 await expect(page.getByRole('heading',{name:'Segundo evento local'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Primeiro evento local'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Carregar mais atividades'})).toHaveCount(0);
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.locator('#hero-title').evaluate(element=>getComputedStyle(element).color)).toBe('rgb(245, 239, 226)');
 await expect(page.getByText('Frete grátis para todo o Brasil em compras acima de R$ 299')).toHaveCount(0);
 console.log('PASS: activity failure is distinct from empty success; retry recovers; hero is legible and blanket freight promise is removed.');
} finally {await browser.close();}
