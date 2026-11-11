"""Checks the engine against the worked example in the course notes (slides 8-26)."""

import unittest

from holtrop import default_ship, resistance


class WorkedExample(unittest.TestCase):
    def setUp(self):
        self.r = resistance(default_ship(), 25)

    def test_intermediates(self):
        expected = {"CB": 0.5716, "CP": 0.5833, "Fn": 0.2868, "LR": 81.39, "S": 7381.5,
                    "CF": 0.001390, "c12": 0.5102, "k1": 1.156, "iE": 12.08, "c1": 1.398,
                    "c3": 0.02119, "c2": 0.7595, "c5": 0.9592, "c16": 1.3809, "m1": -2.1274,
                    "m2": -0.1708, "lam": 0.6513, "PB": 0.6261, "Fni": 1.508, "FnT": 5.432,
                    "CA": 0.000352}
        for key, value in expected.items():
            self.assertAlmostEqual(self.r[key] / value, 1, delta=2e-3, msg=key)  # slides round to 3-4 figures

    def test_components_kN(self):
        expected = {"RF_k1": 1005.5, "RAPP": 8.83, "RW": 556.7, "RA": 220.5, "RT": 1791.6}
        for key, value in expected.items():
            self.assertAlmostEqual(self.r[key] / 1000, value, delta=0.1, msg=key)
        self.assertEqual(self.r["RTR"], 0)

    def test_speed_table(self):
        table = {15: 514, 17: 663, 19: 846, 21: 1080, 23: 1433, 25: 1792, 27: 2144, 29: 2645}
        for kn, rt in table.items():
            self.assertAlmostEqual(resistance(default_ship(), kn)["RT"] / 1000, rt, delta=1, msg=kn)


if __name__ == "__main__":
    unittest.main()
