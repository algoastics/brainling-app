import re, subprocess
from harness import *

PKG = "com.zhiliaoapp.musically"
# 1080x2400: bottom bar Home / Friends.
HOME_TAB, FRIENDS_TAB = (108, 2250), (324, 2250)
LOGIN = re.compile(r"^(Log in to TikTok|Sign up for TikTok)")


def dismiss_wall():
    """A login/sign-up wall or popup: back out of it (harness-side). Each uiautomator dump
    rebinds the service, so wait after it or the next events are lost to the harness."""
    try:
        _dismiss()
    finally:
        ui.wait(DWELL)


def _dismiss():
    for _ in range(3):
        ns = ui.ua_nodes()
        if not any(LOGIN.match(n["text"]) for n in ns):
            close = [n for n in ns if n["desc"] in ("Close", "Not now", "Dismiss") or n["text"] in ("Not now", "Skip", "Don’t allow")]
            if close:
                ui.tap_node(close[0]); ui.wait(2)
            return
        ui.back(); ui.wait(2)
    raise RuntimeError("login wall")


def first(pred, what):
    for _ in range(4):
        ns = ui.ua_nodes()
        hit = [n for n in ns if pred(n)]
        if hit:
            return hit[0]
        deny = [n for n in ns if n["text"] in ("Don’t allow", "Don't allow")]  # contacts prompt
        if deny:  # shown asynchronously over the feed
            ui.tap_node(deny[0]); ui.wait(2); ui.wait(DWELL); continue
        ui.wait(1.5)
    ui.adb("pull", "/sdcard/e2e.xml", "/tmp/tt_not_found.xml")  # evidence for a skip
    with open("/tmp/tt_not_found.png", "wb") as f:
        f.write(subprocess.run([ui.ADB, "-s", ui.SERIAL, "exec-out", "screencap", "-p"], capture_output=True).stdout)
    raise RuntimeError(f"not found: {what}")


def for_you():
    ui.tap(*HOME_TAB); ui.wait(2)
    tab = [n for n in ui.ua_nodes() if n["desc"] == "For You"]
    if tab:
        ui.tap_node(tab[0])


def in_player():
    return any(n["rid"].endswith("/player_view") and n["b"][3] - n["b"][1] > 1500 for n in ui.ua_nodes())


def run():
    c = Case(PKG)
    fresh(PKG)
    dismiss_wall()
    for_you(); ui.wait(DWELL)  # settle before the count window: the feed opens on launch

    def open_feed():
        ui.home(); ui.wait(2); ui.adb("shell", "am", "force-stop", PKG); ui.wait(1)
        ui.launch(PKG); ui.wait(8); dismiss_wall(); ui.wait(DWELL); swipes(2)()
    c.step("TT For You open + 2 swipes = 3", 3, open_feed)
    c.step("TT swipe back = 0", 0, swipes(1, up=False))

    def comments():
        btn = first(lambda n: n["desc"].startswith("Read or add comments"), "comments button")
        ui.wait(DWELL)
        ui.tap_node(btn); ui.wait(3); ui.back(); ui.wait(3)
    c.step("TT comments open/close = 0", 0, comments)

    def home_return():
        ui.home(); ui.wait(3); ui.launch(PKG); ui.wait(5)
    c.step("TT home and return = 0", 0, home_return)

    def tab_and_back():
        ui.tap(*FRIENDS_TAB); ui.wait(4); dismiss_wall()
        for _ in range(3):  # the first Home tap after the Friends page loads can be swallowed
            ns = ui.ua_nodes()
            deny = [n for n in ns if n["text"] in ("Don’t allow", "Don't allow")]  # contacts prompt
            if deny:
                ui.tap_node(deny[0]); ui.wait(2); continue
            ui.tap(*HOME_TAB); ui.wait(2.5)
            if any(n["text"] == "For You" for n in ui.ua_nodes()):
                break
    c.step("TT Friends tab and back to For You = 0", 0, tab_and_back)

    extra = [0]  # feed videos swiped past (each counts) while looking for a creator with videos

    def profile():
        dismiss_wall()
        g = None
        for attempt in range(4):
            av = first(lambda n: n["rid"].endswith(("/user_avatar", "/title")), "creator avatar")
            ui.wait(DWELL)
            ui.tap_node(av); ui.wait(5)
            for _ in range(3):
                grid = [n for n in ui.ua_nodes() if n["rid"].endswith("/cover") and n["b"][1] > 500]
                if grid:
                    break
                ui.wait(2)
            if grid:
                g = min(grid, key=lambda n: (n["b"][1], n["b"][0]))
                break
            # Some creators have no videos (empty grid): back out, move to the next feed video.
            ui.back(); ui.wait(2.5); ui.swipe_up(); ui.wait(DWELL); extra[0] += 1
        if g is None:
            raise RuntimeError("no profile grid video")
        for _ in range(3):  # the grid can swallow the first tap while it loads
            ui.tap_node(g); ui.wait(4)
            if in_player():
                break
        else:
            raise RuntimeError("profile video did not open")
    c.step("TT creator profile first video = 1", lambda: 1 + extra[0], profile)

    def profile_swipe():
        ui.wait(DWELL); ui.swipe_up()
    c.step("TT profile player swipe = 1", 1, profile_swipe, needs="TT creator profile first video = 1")

    def back_fy():
        ui.back(); ui.wait(2.5); ui.back(); ui.wait(2.5)
    c.step("TT back to For You = 0", 0, back_fy, needs="TT creator profile first video = 1")
    # Where the feed rests after the profile detour varies (a Home re-tap refreshes it to its first
    # video, which is "seen"). Swipe forward until a count appears: the seen videos on the way must
    # not count and the first new one must count exactly once (up to 5 swipes).
    def forward_to_new():
        n0 = sum(" counted " in l for l in c.log())
        for _ in range(5):
            ui.swipe_up(); ui.wait(DWELL)
            if sum(" counted " in l for l in c.log()) > n0:
                break
    c.step("TT swipes forward over seen videos to a new one = 1", 1, forward_to_new)

    log = c.log()
    lives = sum("live" in l.lower() for l in log)
    ads = sum("reason=ad" in l for l in log)
    c.results.append(("TT Live noted", "N/A" if not lives else "NOTE", f"live log lines={lives}"))
    c.results.append(("TT sponsored skipped", "PASS" if ads else "N/A", f"ad skips={ads}"))
    return c.results
