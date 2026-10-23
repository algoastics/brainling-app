#!/usr/bin/env python3
import sys
import ui

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    ui.adb("logcat", "-c")
    results = []
    if which in ("ig", "all"):
        import instagram
        results += instagram.run()
    if which in ("fb", "all"):
        import facebook
        results += facebook.run()
    if which in ("yt", "all"):
        import youtube
        results += youtube.run()
    print("\n| case | result | detail |\n|---|---|---|")
    for name, res, detail in results:
        print(f"| {name} | {res} | {detail} |")
    sys.exit(1 if any(r == "FAIL" for _, r, _ in results) else 0)
