"""The Python importer hands a complete plan to the validated TS writer."""
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


class ImportTests(unittest.TestCase):
    def test_write_submits_one_batch_and_reports_rejection(self):
        fake_excel = types.ModuleType("openpyxl")
        sheet = Mock()
        sheet.iter_rows.return_value = [("P1", "10g", None, None, None),
                                        ("P2", "20g", None, None, None)]
        fake_excel.load_workbook = Mock(return_value={"Sheet1": sheet})
        spec = importlib.util.spec_from_file_location("importer", Path(__file__).with_name("import-kuuube-pen-data.py"))
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"openpyxl": fake_excel}):
            spec.loader.exec_module(module)
        sources = {Path(f"{pid}.json"): {"EntityId": f"wacom.pen.{pid.lower()}", "PenId": pid}
                   for pid in ("P1", "P2")}
        with patch.object(sys, "argv", ["importer", "--write", "--repo-root", "."]), \
             patch.object(module, "read_wacom_pen_sources", return_value=sources), \
             patch.object(module, "run_generator", return_value=(0, "")), \
             patch.object(module.shutil, "which", return_value="npx"), \
             patch.object(module.subprocess, "run", return_value=Mock(returncode=1, stderr="invalid batch")) as run, \
             patch("builtins.print"):
            with self.assertRaisesRegex(SystemExit, "no source or bundle changes"):
                module.main()
        run.assert_called_once()
        plan = json.loads(run.call_args.kwargs["input"])
        self.assertEqual([entry["record"]["Weight"] for entry in plan], ["10", "20"])
        self.assertTrue(all(entry["collection"] == "pens" for entry in plan))
        self.assertTrue(all("_ModifiedDate" in entry["record"] for entry in plan))
        self.assertTrue(any("apply-update.ts" in arg for arg in run.call_args.args[0]))


if __name__ == "__main__":
    unittest.main()
