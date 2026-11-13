// Loopback-only UI proof. HTTP fixtures prevent email, payments or production mutations.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.EDITOR_TEST_ORIGIN??'http://127.0.0.1:3100';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  let configured=false,acceptance,reset;
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let body={items:[],pageInfo:{hasNextPage:false,nextCursor:null}};
    if(path.endsWith('/auth/me'))return route.fulfill({status:401,contentType:'application/json',body:'{"message":"Unauthenticated"}'});
    if(path.includes('/legal/policies/'))body=configured?{configured:true,id:'11111111-1111-4111-8111-111111111111',title:'Política local de teste',version:2,content:'<script>window.untrustedLegal=true</script> Texto de teste.'}:{configured:false,key:'TERMS'};
    if(path.endsWith('/legal/acceptances')){acceptance=request.postDataJSON();body={ok:true};}
    if(path.endsWith('/auth/password/reset')){reset=request.postDataJSON();body={message:'Senha alterada no teste local.'};}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/termos',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Este documento aguarda configuração', {exact:false})).toBeVisible();
  configured=true;
  await page.reload();
  await expect(page.getByRole('heading',{name:'Política local de teste'})).toBeVisible();
  assert.equal(await page.evaluate(()=>window.untrustedLegal),undefined);
  await page.getByRole('button',{name:/Li e aceito/}).click();
  await expect(page.getByRole('status')).toContainText('Aceite registrado');
  assert.equal(acceptance.policyId,'11111111-1111-4111-8111-111111111111');
  const token='a'.repeat(64);
  await page.goto(origin+'/redefinir-senha#token='+token,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>new URL(page.url()).hash).toBe('');
  await page.locator('input[type=password]').fill('LocalProof!Password123');
  await page.getByRole('button',{name:/Redefinir|Salvar|Alterar/i}).click();
  await expect(page.getByText('Senha alterada no teste local.')).toBeVisible();
  assert.equal(reset.token,token);
  assert.equal(reset.password,'LocalProof!Password123');
  console.log('PASS: unpublished policy state, escaped legal content, version acceptance, fragment removal and password reset payload. HTTP fixtures only.');
} finally {await browser.close();}
