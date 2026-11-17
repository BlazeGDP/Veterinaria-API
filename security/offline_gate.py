#!/usr/bin/env python3
"""Unit-level rule fixture gate; does not claim AWS cloud detection timings."""
import argparse
import json
from pathlib import Path
from datetime import datetime,timezone
from detection import test_fixture
p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args()
ok=test_fixture(Path(__file__).parent/'fixtures/identity-positive-negative.jsonl')
record={'source':'OFFLINE_DETECTION_FIXTURES','experiment':'identity',
    'timestamp':datetime.now(timezone.utc).isoformat(),
    'positiveAndNegativeCasesPassed':ok,'cloudExperimentExecuted':False,
    'mttdSeconds':None,'mttcSeconds':None,'cloudDetectionCoverage':None,
    'warning':'These fixture checks are not a CloudWatch alarm or live game-day measurement.'}
out=Path(a.out);out.parent.mkdir(exist_ok=True,parents=True);out.write_text(json.dumps(record,indent=2)+'\n')
if not ok:raise SystemExit(1)
