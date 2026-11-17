"""Detection as code for AWS CloudWatch structured JSON events.
Test positive and negative fixtures with the same predicate used by the live gate.
"""
import json
from pathlib import Path

def identity_abuse(event: dict) -> bool:
    return event.get('event')=='security_event' and event.get('experiment')=='identity' and \
        event.get('outcome')=='denied' and event.get('reason') in {
            'wrong_issuer_or_audience','expired_or_excessive_ttl',
            'replay_detected','bad_signature','invalid_proof_format','invalid_legacy_secret'
        }

def test_fixture(path):
    items=[json.loads(x) for x in Path(path).read_text().splitlines() if x.strip()]
    if not items:return False
    return all(identity_abuse(row)==row['expectedAlert'] for row in items)
