const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fastify=require('fastify');
const {installMulticloud}=require('../dist/multicloud');
test('live composition, no loops, trace, bounded faults and fallback',async()=>{
  let calls=0, value='game-1'; let seenTrace;
  const peer=http.createServer((req,res)=>{calls++;seenTrace=req.headers.traceparent;res.setHeader('Content-Type','application/json');res.end(JSON.stringify([{id:1,nombre:value},{id:2,nombre:value}]))});
  await new Promise(r=>peer.listen(0,'127.0.0.1',r));
  process.env.PEER_API_URL=`http://127.0.0.1:${peer.address().port}`;
  process.env.CHAOS_ENABLED='true';process.env.CHAOS_TOKEN='t'.repeat(40);
  const app=fastify();installMulticloud(app);
  for(const e of ['owners','pets','appointments']){
    app.get('/'+e,async()=>[{id:1,nombre:e}]);
    app.get('/'+e+'/1',async()=>({id:1,nombre:e}));
  }
  app.get('/pets/raw',async()=>[{id:1,nombre:'pet'}]);
  app.get('/owners/999',async(req,res)=>res.code(404).send({error:'not_found'}));
  try {
    for(const e of ['owners','pets','appointments']){
      for(const suffix of ['','/1']){
        const r=await app.inject('/'+e+suffix);assert.equal(r.statusCode,200);
        const b=r.json();assert.equal(b.integration.status,'ok');assert.ok(!Array.isArray(b.juego));
        assert.equal(seenTrace.split('-')[1],b.traceId);assert.equal(Array.isArray(b.data),suffix==='');
      }
    }
    value='changed-live';assert.equal((await app.inject('/owners')).json().juego.nombre,value);
    const n=calls;assert.ok(Array.isArray((await app.inject('/pets/raw')).json()));assert.equal(calls,n);
    assert.equal((await app.inject('/owners/999')).statusCode,404);
    const headers={'x-chaos-token':process.env.CHAOS_TOKEN,'x-chaos-until':String(Date.now()+15000),'x-chaos-fault':'latency'};
    const start=Date.now();const bounded=await app.inject({url:'/owners',headers});
    assert.ok(Date.now()-start<1800);assert.equal(bounded.json().integration.reason,'timeout');assert.equal(bounded.json().juego,null);
    headers['x-resilience-mode']='baseline';const t=Date.now();assert.equal((await app.inject({url:'/owners',headers})).json().integration.status,'ok');assert.ok(Date.now()-t>=2900);
    headers['x-chaos-fault']='unavailable';assert.equal((await app.inject({url:'/pets/raw',headers})).statusCode,503);
    headers['x-chaos-until']='1';assert.equal((await app.inject({url:'/pets/raw',headers})).statusCode,200);
    headers['x-chaos-until']=String(Date.now()+15000);headers['x-chaos-token']='bad';assert.equal((await app.inject({url:'/pets/raw',headers})).statusCode,200);
    await new Promise(r=>peer.close(r));
    const down=await app.inject('/owners');assert.equal(down.statusCode,200);assert.equal(down.json().integration.status,'degraded');
  } finally {await app.close();peer.close();}
});
