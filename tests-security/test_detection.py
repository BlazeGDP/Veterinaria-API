import importlib.util
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('detector',HERE/'security'/'detection.py')
detector=importlib.util.module_from_spec(spec);spec.loader.exec_module(detector)
class Detection(unittest.TestCase):
    def test_positive_and_negative(self):
        self.assertTrue(detector.test_fixture(HERE/'security/fixtures/identity-positive-negative.jsonl'))
    def test_prevent_false_positive(self):
        self.assertFalse(detector.identity_abuse({'event':'security_event','experiment':'identity','outcome':'allowed','reason':'valid_scoped_proof'}))
