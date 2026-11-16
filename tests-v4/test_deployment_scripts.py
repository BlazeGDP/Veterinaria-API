import importlib.util, pathlib, unittest
path=pathlib.Path(__file__).resolve().parents[1]/'scripts/verify-aws-v4.py'
spec=importlib.util.spec_from_file_location('verification',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class DeploymentSmokeTests(unittest.TestCase):
    def setUp(self):
        self.db={x:[] for x in ['owners','pets','appointments']}
        self.posts=0
        self.peer=True
    def call(self,base,path,payload=None):
        if path=='/health':return {'status':'ok'}
        parts=path.strip('/').split('/'); rows=self.db[parts[0]]
        if payload is not None:
            result=dict(payload,id=str(len(rows)+1));rows.append(result);self.posts+=1
            return result
        data=rows if len(parts)==1 else next(x for x in rows if x['id']==parts[1])
        return {'data':data,'traceId':'test','juego':{'id':1} if self.peer else None,'integration':{'status':'ok' if self.peer else 'degraded'}}
    def test_seed_is_idempotent_and_checks_details(self):
        first=m.verify('http://unused',True,True,self.call)
        second=m.verify('http://unused',True,True,self.call)
        self.assertEqual(first,second);self.assertEqual(self.posts,3)
    def test_optional_peer_can_be_absent_during_bootstrap(self):
        self.peer=False;m.verify('http://unused',False,False,self.call)
    def test_configured_broken_peer_fails(self):
        self.peer=False
        with self.assertRaises(AssertionError):m.verify('http://unused',False,True,self.call)
