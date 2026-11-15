import { randomBytes, timingSafeEqual } from 'node:crypto';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
function authorized(req: any): boolean {
  const token = process.env.CHAOS_TOKEN || '';
  const given = String(req.headers['x-chaos-token'] || '');
  const until = Number(req.headers['x-chaos-until']);
  return process.env.CHAOS_ENABLED === 'true' && token.length >= 32 &&
    Buffer.byteLength(given) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(given), Buffer.from(token)) &&
    until > Date.now() && until <= Date.now() + 300000;
}
export function installMulticloud(server: any) {
  server.addHook('onRequest', async (req: any, reply: any) => {
    const parent = String(req.headers.traceparent || '');
    const valid = /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/.test(parent);
    req.traceId = valid ? parent.split('-')[1] : randomBytes(16).toString('hex');
    req.spanId = randomBytes(8).toString('hex');
    req.traceparent = `00-${req.traceId}-${req.spanId}-01`;
    req.v4Start = Date.now();
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Trace-Id', req.traceId).header('traceparent', req.traceparent);
    if (req.url.split('?')[0] === '/pets/raw' && authorized(req) && req.headers['x-chaos-fault'] === 'unavailable') {
      reply.code(503).send({error: 'injected_dependency_unavailable', traceId: req.traceId});
    }
  });
  server.addHook('preSerialization', async (req: any, reply: any, payload: any) => {
    if (req.method !== 'GET' || reply.statusCode !== 200 ||
        !/^\/(owners|pets|appointments)(\/\d+)?\/?$/.test(req.url.split('?')[0])) return payload;
    const active = authorized(req);
    const fault = active ? String(req.headers['x-chaos-fault'] || '') : '';
    const protectedMode = !(active && req.headers['x-resilience-mode'] === 'baseline');
    const budget = protectedMode ? 800 : 6000;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    let game: any = null, reason: string | null = null;
    try {
      if (!process.env.PEER_API_URL) throw new Error('peer_not_configured');
      // Delay is inside the dependency budget, so timeout also bounds injected latency.
      if (fault === 'latency') {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 3000);
          controller.signal.addEventListener('abort', () => {clearTimeout(t); reject(new Error('timeout'));}, {once:true});
        });
      }
      const res = await fetch(`${process.env.PEER_API_URL.replace(/\/$/, '')}/juegos/raw`, {
        headers: {traceparent: req.traceparent}, signal: controller.signal,
      });
      if (!res.ok) throw new Error(`peer_http_${res.status}`);
      const values: any = await res.json();
      if (!Array.isArray(values) || !values.length) throw new Error('peer_empty');
      game = values[Math.floor(Math.random()*values.length)];
    } catch (e) {
      reason = controller.signal.aborted ? 'timeout' : (e as Error).message;
      if (!protectedMode) reply.code(502);
    } finally {
      clearTimeout(timer);
      console.log(JSON.stringify({event:'dependency_span',cloud:'aws',traceId:req.traceId,
        spanId:randomBytes(8).toString('hex'),parentSpanId:req.spanId,peer:'gcp',
        durationMs:Date.now()-start,fault,mode:protectedMode?'protected':'baseline',status:reason || 'ok'}));
    }
    return {data:payload, juego:game, integration:{status:reason?'degraded':'ok',reason,live:true},traceId:req.traceId};
  });
  server.addHook('onResponse', async (req: any, reply: any) => {
    console.log(JSON.stringify({event:'server_span',cloud:'aws',traceId:req.traceId,spanId:req.spanId,
      parentSpanId:String(req.headers.traceparent || '').split('-')[2] || null,
      path:req.url.split('?')[0],status:reply.statusCode,durationMs:Date.now()-req.v4Start}));
  });
}
