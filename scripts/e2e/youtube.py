import re
from harness import *

PKG = "com.google.android.youtube"
# 1080x2400: bottom pivot bar.
HOME_TAB, SHORTS_TAB = (108, 2274), (324, 2274)


def visible_h(n):
    return min(n["b"][3], 2211) - max(n["b"][1], 262)


def in_player():
    return any(n["rid"].endswith("/reel_recycler") and n["b"][3] - n["b"][1] > 1500 for n in ui.ua_nodes())


def scroll_find(pred, tries=12):
    for _ in range(tries):
        hits = [n for n in ui.ua_nodes() if pred(n) and visible_h(n) > 300]
        if hits:
            return hits[0]
        ui.adb("shell", "input", "swipe", "540", "1800", "540", "900", "400"); ui.wait(1.5)
    raise RuntimeError("not found")


def tap_visible(n):
    l, t, r, b = n["b"]
    ui.tap((l + r) // 2, (max(t, 262) + min(b, 2211)) // 2)


def open_until_player(pred):
    for _ in range(3):
        n = scroll_find(pred)
        ui.wait(DWELL)  # the dump rebinds the service: a tap right after it loses its click event
        tap_visible(n); ui.wait(3)
        if in_player():
            return
        ui.back(); ui.wait(2)
    raise RuntimeError("short did not open")


def reel_sig():
    """Text of the on-screen reel's overlay (harness-side only), to tell whether a swipe moved."""
    return sorted(n["desc"] + n["text"] for n in ui.ua_nodes() if 262 < n["b"][1] < 2211 and (n["desc"] or n["text"]))


is_short = lambda n: n["desc"].endswith("- play Short")


def run():
    c = Case(PKG)
    fresh(PKG)

    def shorts_tab():
        ui.tap(*SHORTS_TAB); ui.wait(DWELL); swipes(2)()
    c.step("YT Shorts tab open + 2 swipes = 3", 3, shorts_tab)
    c.step("YT swipe back = 0", 0, swipes(1, up=False))

    def comments():
        for _ in range(2):
            btn = [n for n in ui.ua_nodes() if re.match(r"^(View [\d,.KM]+ comments?|Comments?)$", n["desc"])]
            if not btn:
                raise RuntimeError("no comments button")
            ui.tap_node(btn[0]); ui.wait(2.5); ui.back(); ui.wait(2.5)
    c.step("YT comments open/close x2 = 0", 0, comments)

    def home_return():
        ui.home(); ui.wait(3); ui.launch(PKG); ui.wait(4)
    c.step("YT home and return = 0", 0, home_return)

    def shelf():
        ui.tap(*HOME_TAB); ui.wait(3); open_until_player(is_short)
    c.step("YT Home shelf short opens player = 1", 1, shelf)
    c.step("YT shelf player swipe = 1", 1, swipes(1), needs="YT Home shelf short opens player = 1")

    def back_tab():
        ui.back(); ui.wait(2.5); ui.tap(*SHORTS_TAB)
    c.step("YT back, Shorts tab again = 0", 0, back_tab)

    def channel():
        for _ in range(6):  # the Short's controls are missing while it loads
            ch = [n for n in ui.ua_nodes() if n["desc"].startswith("Go to channel")]
            if ch:
                break
            ui.wait(2)
        if not ch:
            raise RuntimeError("no channel link")
        ui.tap_node(ch[0]); ui.wait(4)
        tab = None
        for _ in range(3):
            tab = [n for n in ui.ua_nodes() if n["text"] == "Shorts" and n["b"][1] < 2100]
            if tab:
                break
            ui.adb("shell", "input", "swipe", "540", "1500", "540", "1000", "300"); ui.wait(1.5)
        if tab:  # channels with only Shorts have no tabs: the grid is the page
            ui.tap_node(tab[0]); ui.wait(3)
        open_until_player(lambda n: n["b"][2] - n["b"][0] < 600 and n["b"][3] - n["b"][1] > 500 and n["desc"] != "")
        # A uiautomator dump rebinds the service; let it settle before the swipe (and the
        # check after it) or the swipe's events are lost to the harness, not to detection.
        before = reel_sig(); ui.wait(DWELL)
        ui.swipe_up(); ui.wait(DWELL)
        if reel_sig() == before:  # a harness limit, not a detection result
            raise RuntimeError("swipe did not move (channel has one short?)")
    c.step("YT channel Shorts first short + swipe = 2", 2, channel)

    def long_video():
        for _ in range(2):
            ui.back(); ui.wait(1.5)
        ui.launch(PKG); ui.wait(3)  # back may have left the app
        ui.tap(*HOME_TAB); ui.wait(3)
        tap_visible(scroll_find(lambda n: n["b"][2] - n["b"][0] > 1000 and n["b"][3] - n["b"][1] > 600
                                and re.search(r"\d+ (minutes|seconds)", n["desc"])
                                and not re.search(r"Sponsored|play Short|live", n["desc"])))
        ui.wait(8)
    c.step("YT long video playing = 0", 0, long_video)
    ads = sum("reason=ad" in l for l in c.log())
    c.results.append(("YT sponsored short skipped", "PASS" if ads else "N/A", f"ad skips={ads}"))
    return c.results
