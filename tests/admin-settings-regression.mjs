// UI regression against a local production build; HTTP fixtures prevent real mutations.
// Covers Admin → Configurações (catalog-service /admin/settings) and the
// storefront fallback when /public/settings is unreachable.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const origin=process.env.SETTINGS_TEST_ORIGIN??'http://127.0.0.1:3100';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Only run against a loopback build');

const adminMe={user:{id:randomUUID(),email:'admin@example.test',status:'ACTIVE',roles:['ADMIN'],createdAt:new Date().toISOString()},profile:{id:randomUUID(),fullName:'Local admin',phone:null},customer:null,admin:{id:randomUUID()}};
const json=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});

async function adminFlow(browser){
 let stored={announcementEnabled:true,announcementText:null,supportEmail:null,supportWhatsapp:null,updatedAt:null,updatedByUserId:null};
 const puts=[];
 const page=await browser.newPage();
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/auth/me'))return json(route,200,adminMe);
  if(path.endsWith('/admin/settings')&&req.method()==='GET')return json(route,200,stored);
  if(path.endsWith('/admin/settings')&&req.method()==='PUT'){
   const body=req.postDataJSON();puts.push(body);
   stored={...body,updatedAt:new Date().toISOString(),updatedByUserId:adminMe.user.id};
   return json(route,200,stored);
  }
  return json(route,200,{items:[],pageInfo:{hasNextPage:false,nextCursor:null}});
 });
 await page.goto(origin+'/admin/configuracoes',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Configurações',exact:true})).toBeVisible({timeout:15000});
 const consent=page.getByRole('button',{name:'Recusar medição',exact:true});
 if(await consent.isVisible().catch(()=>false)) await consent.click();
 await expect(page.getByText('Ainda não salvo: a vitrine usa os textos padrão.')).toBeVisible();
 const save=page.getByRole('button',{name:'Salvar',exact:true});
 await expect(save,'Nothing to save before editing').toBeDisabled();
 // Legacy demo fields must not be present.
 for(const legacy of ['Comissão padrão (%)','Restaurar padrões','Pix habilitado']) await expect(page.getByText(legacy)).toHaveCount(0);

 await page.getByLabel('E-mail de suporte').fill('contato@');
 await page.getByLabel('WhatsApp de suporte').fill('11 99999-0000');
 await save.click();
 await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
 await expect(page.getByText(/Use DDI 55/)).toBeVisible();
 assert.equal(puts.length,0,'Invalid form must not reach the API');

 await page.getByLabel('Texto do aviso').fill('  Frete grátis acima de R$ 299  ');
 await page.getByLabel('E-mail de suporte').fill('suporte@institutopotala.com.br');
 await page.getByLabel('WhatsApp de suporte').fill('+55 (11) 99999-0000');
 const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/admin/settings'));
 await save.click();await saved;
 assert.deepEqual(puts.at(-1),{announcementEnabled:true,announcementText:'Frete grátis acima de R$ 299',supportEmail:'suporte@institutopotala.com.br',supportWhatsapp:'5511999990000'});
 await expect(page.getByText('Configurações salvas')).toBeVisible();
 await expect(page.getByText(/Última alteração em/)).toBeVisible();
 await expect(save,'Saved form is clean again').toBeDisabled();

 await page.getByLabel('Exibir aviso no topo da vitrine').uncheck();
 await expect(page.getByLabel('Texto do aviso')).toBeDisabled();
 await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();
 await expect(page.getByLabel('Exibir aviso no topo da vitrine')).toBeChecked();
 assert.equal(puts.length,1,'Discard must not call the API');
 await page.close();
}

async function loadFailure(browser){
 const page=await browser.newPage();
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return json(route,200,adminMe);
  if(path.endsWith('/admin/settings'))return json(route,503,{statusCode:503,message:'catalog-service is unavailable. Try again shortly.'});
  return json(route,200,{items:[],pageInfo:{hasNextPage:false,nextCursor:null}});
 });
 await page.goto(origin+'/admin/configuracoes',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Não foi possível carregar as configurações'})).toBeVisible({timeout:15000});
 await expect(page.getByText('catalog-service is unavailable. Try again shortly.')).toBeVisible();
 await expect(page.getByLabel('E-mail de suporte'),'No form with fake values when loading fails').toHaveCount(0);
 await page.close();
}

async function storefrontFallback(browser){
 // The local build points API_UPSTREAM_URL at a closed port: /public/settings
 // fails server-side and the storefront must keep the default texts.
 const page=await browser.newPage();
 const response=await page.goto(origin+'/contato',{waitUntil:'domcontentloaded'});
 assert.ok(response&&response.status()<500,`Storefront must not 5xx when settings are unreachable (got ${response?.status()})`);
 await expect(page.getByText('Entrega e retirada conforme as opções de cada loja')).toBeVisible();
 await expect(page.locator('footer a[href^="mailto:"]')).toHaveText('contato@institutopotala.com.br');
 await page.close();
}

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 await adminFlow(browser);
 await loadFailure(browser);
 await storefrontFallback(browser);
 console.log('admin-settings-regression: OK');
}finally{await browser.close();}
