#!/usr/bin/env python3
"""Tiny adb/uiautomator helpers for the Brainling e2e harness (emulator only)."""
import os, re, subprocess, sys, time

SERIAL = os.environ.get("E2E_SERIAL", "emulator-5554")
ADB = os.path.expanduser("~/Library/Android/sdk/platform-tools/adb")


def adb(*args, check=False, timeout=20):
    try:
        return subprocess.run([ADB, "-s", SERIAL, *args], capture_output=True, text=True,
                              check=check, timeout=timeout).stdout
    except subprocess.TimeoutExpired:
        return ""


LINE = re.compile(r"^(\s*)(\S+)\{\w+ (\S{9}) \S{8} (-?\d+),(-?\d+)-(-?\d+),(-?\d+)(?: #\w+ (\S+))?")


def nodes(pkg=None):
    """Visible views of the top activity from `dumpsys activity top`.

    Not uiautomator: a UiAutomation connection suppresses and then rebinds every accessibility
    service, which restarts Brainling's service (empty state) on each dump.
    """
    out, stack, section = [], [], False
    for line in adb("shell", "dumpsys", "activity", "top").splitlines():
        if line.lstrip().startswith("ACTIVITY "):
            section = pkg is None or f" {pkg}/" in line
            stack = []
            continue
        m = LINE.match(line) if section else None
        if not m:
            continue
        ind, cls, flags, l, t, r, b, rid = m.groups()
        depth = len(ind)
        while stack and stack[-1][0] >= depth:
            stack.pop()
        px, py, pvis = stack[-1][1:] if stack else (0, 0, True)
        ax, ay = px + int(l), py + int(t)
        vis = pvis and flags[0] == "V"
        stack.append((depth, ax, ay, vis))
        w, h = int(r) - int(l), int(b) - int(t)
        if vis and w > 0 and h > 0:
            out.append(dict(id=(rid or "").split("/")[-1].rstrip("}"), desc="", text="", cls=cls,
                            b=[ax, ay, ax + w, ay + h]))
    return out


def find(pred, ns=None):
    for n in ns if ns is not None else nodes():
        if pred(n):
            return n
    return None


def tap_node(n):
    l, t, r, b = n["b"]
    adb("shell", "input", "tap", str((l + r) // 2), str((t + b) // 2))


def tap(x, y):
    adb("shell", "input", "tap", str(x), str(y))


def swipe_up(ms=300):  # next reel
    adb("shell", "input", "swipe", "540", "1800", "540", "600", str(ms))


def swipe_down(ms=300):  # previous reel
    adb("shell", "input", "swipe", "540", "700", "540", "1900", str(ms))


def back():
    adb("shell", "input", "keyevent", "4")


def home():
    adb("shell", "input", "keyevent", "3")


def launch(pkg):
    act = adb("shell", "cmd", "package", "resolve-activity", "--brief", "-c",
              "android.intent.category.LAUNCHER", pkg).strip().splitlines()[-1]
    adb("shell", "am", "start", "-n", f"'{act}'")  # quoted: YouTube's activity has a $


def wait(s):
    time.sleep(s)


if __name__ == "__main__":  # dump: python3 ui.py
    for n in nodes():
        if n["id"] or n["desc"] or n["text"]:
            print(n["id"], "|", n["desc"][:50], "|", n["text"][:30], n["b"], n["cls"].split(".")[-1])


def ua_nodes():
    """uiautomator dump (text/content-desc). Rebinds accessibility services on the emulator;
    the service keeps sessions process-wide, so this is safe between steps."""
    adb("shell", "uiautomator", "dump", "/sdcard/e2e.xml")
    xml = adb("shell", "cat", "/sdcard/e2e.xml")
    out = []
    for m in re.finditer(r"<node [^>]*>", xml):
        t = m.group(0)
        g = lambda k: (re.search(k + r'="([^"]*)"', t) or [0, ""])[1]
        b = [int(v) for v in re.findall(r"\d+", g("bounds"))]
        if len(b) == 4:
            out.append({"text": g("text"), "desc": g("content-desc"), "b": b, "rid": g("resource-id")})
    return out


def ua_find(pattern, nodes=None):
    rx = re.compile(pattern, re.I)
    return [n for n in (nodes if nodes is not None else ua_nodes()) if rx.search(n["text"]) or rx.search(n["desc"])]
