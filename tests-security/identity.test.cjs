const { test } = require('node:test');
const assert = require('node:assert/strict');
const fastify = require('fastify');
const { installMulticloud } = require('../dist/multicloud');
const {issueTestProof,checkMachineProof,clearProofReplayCache} = require('../dist/security/service-auth');
const secret='test_secret_for_security_game_day_1234567890';
test('mode off defaults preserve V4 and baseline accepts reused static proof',()=>{
  assert.equal(checkMachineProof('', 'off','').allowed,true);
  assert.equal(checkMachineProof(secret,'baseline',secret).allowed,true);
  assert.equal(checkMachineProof('wrong','baseline',secret).allowed,false);
});
test('short life, audience, signature and replay',()=>{
  clearProofReplayCache();
  let token=issueTestProof(secret);
  assert.equal(checkMachineProof(token,'protected',secret).allowed,true);
  assert.equal(checkMachineProof(token,'protected',secret).reason,'replay_detected');
  token=issueTestProof(secret,{aud:'other-service'});
  assert.equal(checkMachineProof(token,'protected',secret).reason,'wrong_issuer_or_audience');
  token=issueTestProof(secret,{exp:Math.floor(Date.now()/1000)-100});
  assert.equal(checkMachineProof(token,'protected',secret).reason,'expired_or_excessive_ttl');
  token=issueTestProof(secret,{exp:Math.floor(Date.now()/1000)+1000});
  assert.equal(checkMachineProof(token,'protected',secret).reason,'expired_or_excessive_ttl');
  assert.equal(checkMachineProof('v1.bad.token','protected',secret).allowed,false);
});
test('real Fastify hook denies unauthorized machines but leaves health route untouched', async()=>{
  const app=fastify();
  const previousMode=process.env.SECURITY_AUTH_MODE;
  const previousSecret=process.env.SERVICE_AUTH_SECRET;
  process.env.SECURITY_AUTH_MODE='protected';process.env.SERVICE_AUTH_SECRET=secret;
  installMulticloud(app);
  app.get('/pets/raw',async()=>[{id:1}]);app.get('/health/live',async()=>({ok:true}));
  try {
    assert.equal((await app.inject('/pets/raw')).statusCode,401);
    const allowed=await app.inject({url:'/pets/raw',headers:{'x-service-token':issueTestProof(secret)}});
    assert.equal(allowed.statusCode,200);
    assert.equal((await app.inject('/health/live')).statusCode,200);
  } finally {await app.close();if(previousMode===undefined)delete process.env.SECURITY_AUTH_MODE;else process.env.SECURITY_AUTH_MODE=previousMode;
    if(previousSecret===undefined)delete process.env.SERVICE_AUTH_SECRET;else process.env.SERVICE_AUTH_SECRET=previousSecret;}
});
