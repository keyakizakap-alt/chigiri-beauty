import assert from 'node:assert/strict';
import test from 'node:test';
import {validChatBody, validImageSignature, boundedRequest, sameOriginMutation} from '../server/request-validation.mjs';
import {validPlanActions, chatLimits} from '../server/care-plan.mjs';
import {viewerFromRequest, cookieValue, createSessionCookie} from '../server/auth.ts';

test('identity headers do not authenticate public requests; signed sessions do', async () => {
  process.env.AUTH_SECRET = 'test-only-key-with-at-least-32-characters';
  delete process.env.TRUST_PLATFORM_AUTH_HEADERS;
  assert.equal(await viewerFromRequest(new Request('https://app.test', {headers:{'oai-authenticated-user-email':'victim@example.test'}})), null);
  const cookie = await createSessionCookie('owner@example.test', 'Owner');
  assert.equal((await viewerFromRequest(new Request('https://app.test', {headers:{cookie:`chigiri_session=${cookie}`}}))).email, 'owner@example.test');
  assert.equal(await viewerFromRequest(new Request('https://app.test', {headers:{cookie:`chigiri_session=${cookie}x`}})), null);
  assert.equal(cookieValue(new Request('https://app.test', {headers:{cookie:'chigiri_session=%xx'}}), 'chigiri_session'), null);
  process.env.VERCEL = '1'; process.env.TRUST_PLATFORM_AUTH_HEADERS = 'true';
  assert.equal(await viewerFromRequest(new Request('https://app.test', {headers:{'oai-authenticated-user-email':'victim@example.test'}})), null);
  delete process.env.TRUST_PLATFORM_AUTH_HEADERS; delete process.env.VERCEL;
});
test('rejects malformed chat shapes instead of throwing on string/array methods', () => {
  for (const body of [null, [], {input:4}, {history:{}}, {history:[null]}, {history:[{text:4}]}, {memory:{facts:'x'}}, {images:['a','b','c']}]) assert.equal(validChatBody(body), false);
  assert.equal(validChatBody({input:'相談',history:[{role:'user',text:'乾燥'}],memory:{facts:[]}}), true);
});
test('cross-site mutations and forged MIME types fail closed', () => {
  assert.equal(sameOriginMutation(new Request('https://app.test/api/chat',{headers:{origin:'https://evil.test'}})), false);
  assert.equal(sameOriginMutation(new Request('https://app.test/api/chat',{headers:{origin:'https://app.test'}})), true);
  assert.equal(sameOriginMutation(new Request('https://app.test/api/chat')), false);
  assert.equal(validImageSignature(new TextEncoder().encode('<html>'), 'image/png'), false);
  assert.equal(validImageSignature(Uint8Array.from([137,80,78,71,13,10,26,10]), 'image/png'), true);
});
test('limits actual streamed bytes even without Content-Length', async () => {
  await assert.rejects(() => boundedRequest(new Request('https://app.test',{method:'POST',body:'123456'}),5), RangeError);
  const r = await boundedRequest(new Request('https://app.test',{method:'POST',body:'12345'}),5);
  assert.equal(await r.text(), '12345');
});
test('plans require bounded actions; quotas include an app-wide ceiling', () => {
  assert.equal(validPlanActions([{specialist:'skin',title:'いつものケア',detail:'記録する'}]),true);
  assert.equal(validPlanActions([{specialist:'medical',title:'診断',detail:''}]),false);
  assert.equal(validPlanActions([]),false);
  assert.equal(chatLimits('guest:a',0)[1].limit,20);
  assert.equal(chatLimits('user:a',0)[1].limit,100);
  assert.equal(chatLimits('guest:a',0)[2].key,chatLimits('guest:b',0)[2].key);
});
