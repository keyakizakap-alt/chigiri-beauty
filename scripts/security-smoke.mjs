// Runs against an isolated test database, never against production data.
import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
let checks = 0;
const request = async (path, method='GET', body, cookie='') => {
  const r = await fetch(base+path, {method, headers:{origin:base, cookie, 'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return r;
};
const first = await request('/api/care-plans');
assert.equal(first.status,200);checks++;
const cookie = first.headers.get('set-cookie').split(';')[0];
const action = {specialist:'skin',title:'テスト用のケア',detail:'既存のケアを記録'};
const day = '2026-09-12';
assert.equal((await request('/api/care-plans','POST',{day,actions:[action]},cookie)).status,201);checks++;
assert.equal((await request('/api/care-plans','POST',{day,actions:[action]},cookie)).status,409);checks++;
assert.equal((await (await request('/api/care-plans')).json()).plans.length,0);checks++;
const spoof = await fetch(base+'/api/care-plans',{headers:{'oai-authenticated-user-email':'victim@example.test'}});
assert.equal((await spoof.json()).plans.length,0);checks++;
assert.equal((await request('/api/care-plans','PATCH',{day,index:0,done:true,revision:1},cookie)).status,200);checks++;
assert.equal((await request('/api/care-plans','PATCH',{day,index:0,done:false,revision:1},cookie)).status,409);checks++;
assert.equal((await (await request('/api/care-plans','GET',undefined,cookie)).json()).plans[0].actions[0].done,true);checks++;
assert.equal((await request('/api/care-plans','PATCH',{day,index:0,done:true,revision:2})).status,404);checks++;
const crossSite = await fetch(base+'/api/care-plans',{method:'POST',headers:{origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({day,actions:[action]})});
assert.equal(crossSite.status,403);checks++;
for (const body of [null,{input:2},{history:[null]},{memory:{facts:'bad'}}]) {assert.equal((await request('/api/chat','POST',body,cookie)).status,400);checks++;}
assert.equal((await request('/api/chat','POST',{input:'a'.repeat(140000)},cookie)).status,413);checks++;
assert.equal((await request('/api/uploads?key=chat-images/foreign-image','GET',undefined,cookie)).status,404);checks++;
for(let i=0;i<10;i++) assert.equal((await request('/api/chat','POST',{input:'こんにちは'},cookie)).status,200);
assert.equal((await request('/api/chat','POST',{input:'こんにちは'},cookie)).status,429);checks++;
assert.equal((await request('/api/care-plans?day='+day,'DELETE',undefined,cookie)).status,200);checks++;
assert.equal((await (await request('/api/care-plans','GET',undefined,cookie)).json()).plans.length,0);checks++;
console.log(`${checks} integration assertions passed (plus 10 quota setup requests)`);
