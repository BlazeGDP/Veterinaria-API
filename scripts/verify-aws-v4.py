#!/usr/bin/env python3
"""Smoke check plus idempotent synthetic data for repeated deployments."""
import json, os, urllib.request
from datetime import datetime, timedelta, timezone

def request(base, path, payload=None):
    req=urllib.request.Request(base.rstrip('/')+path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)

def verify(base, seed=False, require_peer=False, call=request):
    assert call(base,'/health')['status']=='ok', 'health failed'
    owners=call(base,'/owners')['data']
    pets=call(base,'/pets')['data']
    appointments=call(base,'/appointments')['data']
    records={}
    if seed:
        owner=next((x for x in owners if x.get('email')=='demo-v4@example.com'),None)
        if owner is None:
            owner=call(base,'/owners',{'nombre':'Persona','apellido':'Sintetica','telefono':'3000000000','email':'demo-v4@example.com'})
        pet=next((x for x in pets if x.get('nombre')=='Mascota demo V4' and str(x.get('ownerId'))==str(owner['id'])),None)
        if pet is None:
            pet=call(base,'/pets',{'nombre':'Mascota demo V4','especie':'Perro','raza':'Mestizo','edad':2,'ownerId':int(owner['id'])})
        appointment=next((x for x in appointments if x.get('motivo')=='Revision demo V4' and str(x.get('petId'))==str(pet['id'])),None)
        if appointment is None:
            appointment=call(base,'/appointments',{'fecha':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),'motivo':'Revision demo V4','petId':str(pet['id'])})
        records={'owners':owner['id'],'pets':pet['id'],'appointments':appointment['id']}
    paths=['/owners','/pets','/appointments']+['/'+e+'/'+str(i) for e,i in records.items()]
    for path in paths:
        body=call(base,path)
        assert 'data' in body and 'traceId' in body, 'Invalid V4 response: '+path
        if require_peer:
            assert body.get('integration',{}).get('status')=='ok' and isinstance(body.get('juego'),dict), 'GCP integration failed: '+path
    return records

if __name__=='__main__':
    result=verify(os.environ['AWS_API_URL'],os.getenv('SEED_DEMO')=='true',bool(os.getenv('TF_VAR_peer_api_url')))
    print(json.dumps({'localSmoke':'ok','demoIds':result,'peerRequired':bool(os.getenv('TF_VAR_peer_api_url'))},indent=2))
