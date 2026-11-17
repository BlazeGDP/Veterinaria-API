/** Security game day: request-scoped machine proof for the GCP -> AWS raw dependency.
 * This is an HMAC proof, NOT GCP IAM federation or a replacement for mTLS.
 * SECURITY_AUTH_MODE=off preserves the currently deployed V4 behavior.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ISSUER = 'videojuegos-gcp';
const AUDIENCE = 'veterinaria-aws:/pets/raw';
const MAX_TTL_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 5;
const seen = new Map<string, number>();
function b64(value: string | Buffer): string { return Buffer.from(value).toString('base64url'); }
function constantEqual(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export type Decision = { allowed: boolean; reason: string; mode: string };
export function issueTestProof(secret: string, overrides: Record<string, unknown> = {}, at = Math.floor(Date.now()/1000)): string {
  const claims = { iss: ISSUER, aud: AUDIENCE, iat: at, exp: at + 30,
    jti: randomBytes(16).toString('hex'), ...overrides };
  const p = b64(JSON.stringify(claims));
  const signature = b64(createHmac('sha256', secret).update(`v1.${p}`).digest());
  return `v1.${p}.${signature}`;
}
export function clearProofReplayCache(): void { seen.clear(); }
export function checkMachineProof(proof: string, mode: string,
  secret: string, now = Math.floor(Date.now()/1000)): Decision {
  if (mode === 'off') return {allowed:true, reason:'legacy_open', mode};
  if (!secret || Buffer.byteLength(secret) < 32) return {allowed:false, reason:'secret_not_configured', mode};
  if (mode === 'baseline') return {allowed:constantEqual(proof,secret), reason:constantEqual(proof,secret)?'legacy_shared_secret':'invalid_legacy_secret',mode};
  if (mode !== 'protected') return {allowed:false, reason:'unknown_security_mode', mode};
  const parts = proof.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || parts[1].length > 4096) return {allowed:false,reason:'invalid_proof_format',mode};
  const correctSig = b64(createHmac('sha256',secret).update(`v1.${parts[1]}`).digest());
  if (!constantEqual(parts[2],correctSig)) return {allowed:false,reason:'bad_signature',mode};
  let claims: any;
  try {claims = JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}
  catch {return {allowed:false,reason:'invalid_claims',mode};}
  if (claims?.iss !== ISSUER || claims?.aud !== AUDIENCE) return {allowed:false,reason:'wrong_issuer_or_audience',mode};
  if (![claims.iat,claims.exp].every(Number.isSafeInteger) || typeof claims.jti !== 'string' ||
      !/^[a-f0-9]{32}$/.test(claims.jti)) return {allowed:false,reason:'invalid_claims',mode};
  if (claims.iat > now+CLOCK_SKEW_SECONDS || claims.exp < now-CLOCK_SKEW_SECONDS ||
      claims.exp <= claims.iat || claims.exp - claims.iat > MAX_TTL_SECONDS)
    return {allowed:false,reason:'expired_or_excessive_ttl',mode};
  for (const [key, expiry] of seen) if (expiry < now) seen.delete(key);
  if (seen.has(claims.jti)) return {allowed:false,reason:'replay_detected',mode};
  seen.set(claims.jti, claims.exp+CLOCK_SKEW_SECONDS);
  // Per-instance replay protection only: distributed replay cache is residual risk.
  return {allowed:true,reason:'valid_scoped_proof',mode};
}
export function checkMachineRequest(req: any): Decision {
  return checkMachineProof(String(req.headers['x-service-token'] || ''),
    process.env.SECURITY_AUTH_MODE || 'off', process.env.SERVICE_AUTH_SECRET || '');
}
