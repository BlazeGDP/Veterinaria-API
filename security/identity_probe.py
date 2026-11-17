#!/usr/bin/env python3
"""Non-destructive AWS identity game-day probe. Operates ONLY against the supplied
owned Veterinaria endpoint /pets/raw. Never prints the signing secret.

The cloud application must already run SECURITY_AUTH_MODE=baseline or protected.
No result is prefilled: this produces event-level JSONL at execution time.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import hmac
import base64
import json
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.request

def iso(): return datetime.now(timezone.utc).isoformat()
def b64(raw): return base64.urlsafe_b64encode(raw).decode().rstrip('=')
def proof(secret, now=None, aud='veterinaria-aws:/pets/raw', jti=None):
    t = int(time.time()) if now is None else int(now)
    data = {'iss':'videojuegos-gcp','aud':aud,'iat':t,'exp':t+30,'jti':jti or secrets.token_hex(16)}
    p = b64(json.dumps(data,separators=(',',':')).encode())
    s = b64(hmac.new(secret.encode(),f'v1.{p}'.encode(),hashlib.sha256).digest())
    return f'v1.{p}.{s}'

def call(url, token, case, round_no, timeout):
    started=iso()
    req=urllib.request.Request(url,headers={'x-service-token':token,'Cache-Control':'no-store'},method='GET')
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            status,headers=r.status,r.headers
            r.read(10000)
    except urllib.error.HTTPError as exc:
        status,headers=exc.code,exc.headers
        exc.read(10000)
    return {'experiment':'identity','round':round_no,'case':case,'sentAt':started,
            'receivedAt':iso(),'traceId':headers.get('X-Trace-Id'),
            'status':status,'kind':'security_game_day_probe','source':'remote_http'}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--url',required=True,help='Owned AWS API URL; GET /pets/raw only')
    ap.add_argument('--round',type=int,required=True,choices=(0,1))
    ap.add_argument('--out',required=True)
    ap.add_argument('--allow-owned-target',action='store_true',help='Explicit rules of engagement confirmation')
    args=ap.parse_args()
    if not args.allow_owned_target: ap.error('must acknowledge owned endpoint with --allow-owned-target')
    from urllib.parse import urlsplit
    parts=urlsplit(args.url)
    if parts.scheme!='https' and parts.hostname not in ('localhost','127.0.0.1'):
        ap.error('remote target must be HTTPS; use an HTTPS edge or local-only probe')
    if parts.username or parts.password or parts.query or parts.fragment:
        ap.error('provide a plain service base URL without embedded credentials/query')
    secret=os.getenv('SERVICE_AUTH_SECRET','')
    if len(secret.encode())<32: ap.error('SERVICE_AUTH_SECRET >=32 bytes is required')
    dest=Path(args.out)
    dest.parent.mkdir(parents=True,exist_ok=True)
    base=args.url.rstrip('/')+'/pets/raw'
    actions=[]
    if args.round==0:
        actions=[('normal_legacy',secret,200),('unauthorized_reuse',secret,200),('uncredentialed_in_baseline','bad',200)]
    else:
        good=proof(secret)
        actions=[('normal_scoped',good,200),('replay_scoped',good,401),
                 ('wrong_audience',proof(secret,aud='not-this-service'),401),
                 ('expired_scoped',proof(secret,now=int(time.time())-180),401),
                 ('legacy_reuse',secret,401)]
    with dest.open('w',encoding='utf-8') as fh:
        for case,token,expected in actions:
            result=call(base,token,case,args.round,timeout=8)
            result['expectedStatus']=expected
            result['pass']=result['status']==expected
            fh.write(json.dumps(result,ensure_ascii=False)+'\n')
            print(f"{case}: HTTP {result['status']} (expected {expected}), traceId={result['traceId'] or 'missing'}")
    if not all(json.loads(line)['pass'] for line in dest.read_text().splitlines()):
        raise SystemExit('Probe failed: cloud configuration does not match --round, or target unavailable')
    print(f'PROBE PASSED, evidence: {dest}; detection/MTTD needs independently fetched CloudWatch events')

if __name__=='__main__': main()
