#!/usr/bin/env python3
"""Isolated, single-S3-object recovery game day. No production records or Terraform state.

Needs two NEW, dedicated owned buckets named with 'sec-lab': primary and an isolated
backup bucket that was created with Object Lock ENABLED. Never deletes an object.
Pass --execute-live to permit writes to the dedicated synthetic prefix.
"""
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

def iso(): return datetime.now(timezone.utc).isoformat()
def digest(data): return hashlib.sha256(data).hexdigest()
def aws(*args):
    out=subprocess.run(['aws','s3api',*map(str,args)],capture_output=True,check=False)
    if out.returncode: raise RuntimeError('AWS CLI failed: '+out.stderr.decode(errors='replace')[:500])
    return out.stdout
class S3:
    def __init__(self,primary,backup):
        for name in (primary,backup):
            if 'sec-lab' not in name.lower(): raise ValueError('Both bucket names must contain sec-lab')
            details=json.loads(aws('get-bucket-versioning','--bucket',name))
            if details.get('Status')!='Enabled':raise RuntimeError('versioning must be Enabled: '+name)
        policy=json.loads(aws('get-object-lock-configuration','--bucket',backup))
        if policy.get('ObjectLockConfiguration',{}).get('ObjectLockEnabled')!='Enabled':
            raise RuntimeError('isolated backup bucket must have object lock enabled')
        self.primary=primary;self.backup=backup
    def put(self,bucket,key,data,locked=False):
        with tempfile.NamedTemporaryFile() as tmp:
            tmp.write(data);tmp.flush()
            args=['put-object','--bucket',bucket,'--key',key,'--body',tmp.name,
                  '--content-type','application/json']
            if locked:
                retain=(datetime.now(timezone.utc)+timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
                args += ['--object-lock-mode','COMPLIANCE','--object-lock-retain-until-date',retain]
            aws(*args)
    def get(self,bucket,key):
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/'body.json'
            aws('get-object','--bucket',bucket,'--key',key,str(target))
            return target.read_bytes()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--primary-bucket',required=True)
    p.add_argument('--backup-bucket',required=True)
    p.add_argument('--round',type=int,choices=(0,1),required=True)
    p.add_argument('--out',required=True)
    p.add_argument('--execute-live',action='store_true')
    p.add_argument('--affirm-owned',action='store_true')
    args=p.parse_args()
    if not args.execute_live or not args.affirm_owned:
        p.error('Requires --execute-live --affirm-owned; this performs S3 object writes on owned lab buckets')
    if args.primary_bucket==args.backup_bucket:p.error('primary and isolated backup must be different')
    store=S3(args.primary_bucket,args.backup_bucket)
    ident=uuid.uuid4().hex
    key=f'security-game-day/{ident}/synthetic-record.json'
    events=[]
    def event(action,**fields):events.append({'timestamp':iso(),'event':'data_game_day',
       'experiment':'data','cloud':'aws','round':args.round,'traceId':ident,'action':action,**fields})
    old=json.dumps({'kind':'synthetic_pet_flow_snapshot','revision':1,'mascota':{'id':ident,'nombre':'Mascota sintética','especie':'canino'}},separators=(',',':')).encode()
    latest=json.dumps({'kind':'synthetic_pet_flow_snapshot','revision':2,'mascota':{'id':ident,'nombre':'Mascota sintética','especie':'canino'}},separators=(',',':')).encode()
    corrupted=json.dumps({'kind':'synthetic_pet_flow_snapshot','revision':'corrupt','mascota':{'id':ident,'nombre':'CORRUPTED'}},separators=(',',':')).encode()
    store.put(store.primary,key,old);event('create_primary',sha256=digest(old))
    store.put(store.backup,key,old,locked=args.round==1);last_good_backup_at=time.monotonic()
    event('backup_revision_1',locked=args.round==1)
    time.sleep(1.0) # Real elapsed time between initial backup and latest revision.
    store.put(store.primary,key,latest);event('update_primary_revision_2')
    if args.round==1:
        store.put(store.backup,key,latest,locked=True)
        last_good_backup_at=time.monotonic();event('backup_revision_2',locked=True)
    start=time.monotonic()
    store.put(store.primary,key,corrupted);event('inject_overwrite',sha256=digest(corrupted))
    if store.get(store.primary,key)!=corrupted:raise AssertionError('injection did not change lab object')
    restore=store.get(store.backup,key)
    store.put(store.primary,key,restore)
    recovered=store.get(store.primary,key)
    finished=time.monotonic()
    if recovered!=restore:raise AssertionError('recovery checksum failed')
    is_latest=recovered==latest
    # RPO is AGE of latest recoverable point at incident time; if latest restored,
    # actual revision data loss is zero. It is not an application-wide RPO.
    rpo_seconds=max(0.,start-last_good_backup_at)
    rto_seconds=finished-start
    event('verified_recovery',latestRevisionRestored=is_latest,
          restoredSha256=digest(recovered),rpoSeconds=round(rpo_seconds,3),
          rtoSeconds=round(rto_seconds,3))
    result={'scope':'dedicated_synthetic_S3_object','source':'REAL_AWS_S3_API','round':args.round,
       'traceId':ident,'primaryBucket':args.primary_bucket,'backupBucket':args.backup_bucket,
       'objectKey':key,'rpoSeconds':round(rpo_seconds,3),'rtoSeconds':round(rto_seconds,3),
       'dataLossRevisions':0 if is_latest else 1,'restoredLatestRevision':is_latest,
       'backupObjectLockCompliance':args.round==1,'verified':True,'events':events}
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='events'},indent=2))
    print('Evidence',out,'\nNote: WORM backup stays retained for one day; do not delete production buckets.')
if __name__=='__main__':main()
