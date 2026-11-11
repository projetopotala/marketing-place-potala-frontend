// UI regression against a local production build; HTTP fixtures prevent real mutations.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
async function main(){
 const origin=process.env.EDITOR_TEST_ORIGIN??'http://127.0.0.1:3100';
 assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
 const future=hours=>new Date(Date.now()+hours*3600000).toISOString();
 let activity={id:randomUUID(),title:'Editor regression fixture',description:'Local test only',kind:'COURSE',status:'DRAFT',priceCents:0,capacity:10,timezone:'America/Sao_Paulo',enrollmentDeadline:future(1),sessions:[{id:randomUUID(),title:'Local session',startsAt:future(2),endsAt:future(3)}],instructors:[{name:'Instructor A',bio:'Profile A'}],modality:'IN_PERSON',venue:'Initial room',meetingUrl:null};
 let details;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/api/v1/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   let body={items:[],pageInfo:{hasNextPage:false,nextCursor:null}};
   if(path.endsWith('/auth/me'))body={user:{id:randomUUID(),email:'admin@example.test',status:'ACTIVE',roles:['ADMIN'],createdAt:new Date().toISOString()},profile:{id:randomUUID(),fullName:'Local admin',phone:null},customer:null,admin:{id:randomUUID()}};
   else if(path.endsWith('/admin/activities')&&req.method()==='GET')body={items:[activity],pageInfo:{hasNextPage:false,nextCursor:null}};
   else if(path.endsWith('/admin/activities/'+activity.id)&&req.method()==='PUT'){
    const update=req.postDataJSON();activity={...activity,...update,sessions:update.sessions.map((s,i)=>({...s,id:activity.sessions[i].id}))};body=activity;
   }else if(path.endsWith('/details')&&req.method()==='PATCH'){details=req.postDataJSON();activity={...activity,...details};body=activity;}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/admin/atividades',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Editar rascunho',exact:true}).click();
  const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Editar rascunho',exact:true})});
  await form.getByRole('button',{name:'Adicionar instrutor',exact:true}).click();
  await form.locator('[name=instructorName1]').fill('Instructor B');
  await form.locator('[name=instructorBio1]').fill('Profile B');
  const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/admin/activities/'));
  const refreshed=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/admin/activities?'));
  await form.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await saved;await refreshed;
  await page.getByRole('heading',{name:'Nova atividade',exact:true}).waitFor();
  assert.equal(activity.instructors.length,2,'Draft update must contain two instructors');
  const editor=page.locator('article details').filter({hasText:'Editar instrutores, modalidade e acesso'});
  await editor.locator('summary').click();
  await expect(editor.locator('input[name^=name]'),'Details editor must refresh after draft editor changed instructors').toHaveCount(2);
  await editor.locator('textarea[name=venue]').fill('Updated room');
  const updated=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/details'));
  await editor.getByRole('button',{name:'Salvar detalhes',exact:true}).click();await updated;
  assert.deepEqual(details.instructors.map(i=>i.name),['Instructor A','Instructor B'],'Venue-only edit must preserve both instructors');
  console.log('PASS: two activity editors preserve refreshed instructor list.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
