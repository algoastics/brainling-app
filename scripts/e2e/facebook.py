from harness import *

PKG = "com.facebook.katana"
# FB view ids are obfuscated: navigate by content-desc (uiautomator; the service keeps its
# sessions across the rebind that a dump causes) and by fixed tab coordinates.
HOME_TAB, REELS_TAB = (90, 2263), (270, 2263)


def visible_h(n):
    return min(n["b"][3], 2190) - max(n["b"][1], 260)


def scroll_find(pattern, min_h=0, tries=12, index=0):
    for _ in range(tries):
        hits = [n for n in ui.ua_find(pattern) if visible_h(n) > min_h]
        if len(hits) > index:
            return hits[index]
        ui.adb("shell", "input", "swipe", "540", "1800", "540", "900", "400"); ui.wait(1.5)
    raise RuntimeError(f"not found: {pattern}")


def tap_visible(n):
    l, t, r, b = n["b"]
    ui.tap((l + r) // 2, (max(t, 260) + min(b, 2190)) // 2)


def run():
    c = Case(PKG)
    fresh(PKG)

    def row_reel():
        tap_visible(scroll_find(r"^View reel by", min_h=400)); ui.wait(2)
    c.step("FB reels row reel = 1", 1, row_reel)
    c.step("FB row player swipes 2 = 2", 2, swipes(2))

    def comments():
        for _ in range(3):
            btn = [n for n in ui.ua_find(r"^(\d[\d.,KM]* comments?|Comment|Comments)$") if n["b"][0] > 900]
            if not btn:
                ui.adb("pull", "/sdcard/e2e.xml", "/tmp/fb_no_comment.xml")  # evidence for a skip
                raise RuntimeError("no comment button")
            ui.tap_node(btn[0]); ui.wait(2.5); ui.back(); ui.wait(2.5)
    c.step("FB comment sheet open/close x3 = 0", 0, comments)

    def reopen_other():
        ui.back(); ui.wait(2.5)
        tap_visible(scroll_find(r"^View reel by", min_h=400, index=1)); ui.wait(2)
    c.step("FB close, reopen another row reel = 1", 1, reopen_other)

    def feed_video():
        ui.back(); ui.wait(2.5)
        for _ in range(3):
            ui.adb("shell", "input", "swipe", "540", "1800", "540", "900", "400"); ui.wait(1.5)
        tap_visible(scroll_find(r"^Reel$", min_h=800)); ui.wait(2)
    c.step("FB feed video to player = 1", 1, feed_video)
    c.step("FB feed player swipe 2 = 1", 1, swipes(1))
    c.step("FB feed player swipe 3 = 1", 1, swipes(1))

    def reels_tab():
        ui.back(); ui.wait(2.5); ui.tap(*REELS_TAB); ui.wait(2)
    c.step("FB Reels tab watch = 1", 1, reels_tab)
    c.step("FB Reels tab swipe = 1", 1, swipes(1))

    def tab_return():
        ui.tap(*HOME_TAB); ui.wait(3)
        tap_visible(scroll_find(r"^Reel$", min_h=800)); ui.wait(DWELL)
    c.step("FB Home, open a feed player = 1", 1, tab_return)

    def back_to_tab():
        ui.back(); ui.wait(2.5); ui.tap(*REELS_TAB); ui.wait(2)
    c.step("FB back, Reels tab again = 0", 0, back_to_tab)

    def home_return():
        ui.home(); ui.wait(3); ui.launch(PKG); ui.wait(4)
    c.step("FB home and return = 0", 0, home_return)
    ads = sum("reason=ad" in l for l in c.log())
    c.results.append(("FB sponsored reel skipped", "PASS" if ads else "N/A", f"ad skips={ads}"))
    return c.results
