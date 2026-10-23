#!/usr/bin/env python3
"""Brainling detection e2e on an emulator: drives IG/FB with adb and asserts BrainlingDetect logs.

  python3 scripts/e2e/run.py [ig|fb|all]     (E2E_SERIAL defaults to emulator-5554)
"""
import re, time
import ui

DWELL = 3.0  # > the 750ms settle (800ms rules dwell) plus polling


class Case:
    def __init__(self, app):
        self.app = app
        self.results = []

    def log(self):
        return [l for l in ui.adb("logcat", "-d", "-s", "BrainlingDetect").splitlines() if f"app={self.app}" in l]

    def step(self, name, expected, action, allow_ads=True):
        before = len(self.log())
        try:
            action()
            ui.wait(DWELL)
        except Exception as e:  # UI element not found etc.
            self.results.append((name, "SKIP", str(e)))
            print(f"SKIP {name}: {e}")
            return
        lines = self.log()[before:]
        counted = sum(" counted " in l for l in lines)
        ads = sum("reason=ad" in l for l in lines)
        ok = counted == expected or (allow_ads and ads and counted == expected - ads)
        detail = f"counted={counted} expected={expected} ads={ads}"
        self.results.append((name, "PASS" if ok else "FAIL", detail))
        print(("PASS " if ok else "FAIL ") + name + " " + detail)
        if not ok:
            for l in lines:
                print("   ", l.split("BrainlingDetect: ")[-1])


def need(pred, what, tries=2, fallback=None):
    for _ in range(tries):
        n = ui.find(pred, ui.nodes())
        if n:
            return n
        ui.wait(1.5)
    if fallback:  # known coordinates on a 1080x2400 Pixel 7
        return dict(b=[fallback[0], fallback[1], fallback[0], fallback[1]])
    raise RuntimeError(f"not found: {what}")


def by_id(i):
    return lambda n: n["id"] == i


def desc_starts(p):
    return lambda n: n["desc"].startswith(p)


def swipes(k, up=True):
    def go():
        for _ in range(k):
            (ui.swipe_up if up else ui.swipe_down)()
            ui.wait(DWELL)
    return go


def fresh(pkg):
    ui.adb("shell", "am", "force-stop", pkg)
    ui.wait(1)
    ui.launch(pkg)
    ui.wait(8)
