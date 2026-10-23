from harness import *

PKG = "com.instagram.android"


def in_player():
    return any(n["id"] == "clips_viewer_view_pager" and n["b"][0] == 0 and n["b"][3] - n["b"][1] > 1500
               for n in ui.nodes(PKG))


def run():
    c = Case(PKG)
    fresh(PKG)
    reels_tab = lambda: ui.tap_node(need(by_id("clips_tab"), "Reels tab", fallback=(324, 2274)))
    home_tab = lambda: ui.tap_node(need(by_id("feed_tab"), "Home tab", fallback=(108, 2274)))

    def open_reels():
        reels_tab(); ui.wait(DWELL); swipes(2)()
    c.step("IG reels tab open + 2 swipes = 3", 3, open_reels)
    c.step("IG swipe back = 0", 0, swipes(1, up=False))

    def profile():
        ui.tap_node(need(by_id("clips_author_username"), "reel author", fallback=(300, 1995)))
        ui.wait(4)
        tabs = sorted((n for n in ui.nodes(PKG) if n["id"] == "profile_tab_icon_view"), key=lambda n: n["b"][0])
        if len(tabs) >= 2:
            ui.tap_node(tabs[1])
        else:
            ui.tap(540, 845)
        ui.wait(3)
        thumbs = [n for n in ui.nodes(PKG) if n["id"] == "preview_clip_thumbnail"]
        if not thumbs:
            raise RuntimeError("no grid reel")
        # Pages of the profile ViewPager are laid out side by side: fold x back on screen.
        l, t, r, b = min(thumbs, key=lambda n: (n["b"][1], n["b"][0] % 1080))["b"]
        x, y = ((l + r) // 2) % 1080, (t + min(b, 2200)) // 2
        for _ in range(3):  # the grid ignores taps while it is still loading
            ui.tap(x, y); ui.wait(3)
            if in_player():
                break
        else:
            raise RuntimeError("grid reel did not open")
        ui.wait(DWELL)
        ui.swipe_up()
    c.step("IG profile first reel +1, swipe +1 = 2", 2, profile)

    def back_to_reels():
        ui.back(); ui.wait(2); ui.back(); ui.wait(2)
        pass
    c.step("IG back to Reels tab = 0", 0, back_to_reels)
    c.step("IG swipe forward to seen reel = 0", 0, swipes(1))

    def feed_scroll():
        home_tab(); ui.wait(3)
        for _ in range(3):
            ui.adb("shell", "input", "swipe", "540", "1700", "540", "900", "400"); ui.wait(1.5)
    c.step("IG feed scrolling = 0", 0, feed_scroll)

    def feed_video():
        tapped = 0
        for _ in range(30):
            n = ui.find(lambda n: n["id"] == "video_states"
                        and min(n["b"][3], 2200) - max(n["b"][1], 300) > 500, ui.nodes(PKG))
            if n:
                tapped += 1
                ui.tap(540, (max(n["b"][1], 300) + min(n["b"][3], 2200)) // 2); ui.wait(3)
                if in_player():
                    return  # (a plain feed video only toggles sound: scroll on)
            ui.adb("shell", "input", "swipe", "540", "1900", "540", "700", "400"); ui.wait(1.5)
        raise RuntimeError(f"no feed video post opened the player ({tapped} tapped)")
    c.step("IG feed video tapped = 1", 1, feed_video)
    c.step("IG feed player swipes 2 = 2", 2, swipes(2), needs="IG feed video tapped = 1")

    def back_reels():
        ui.back(); ui.wait(2); reels_tab()
    c.step("IG back then Reels tab = 0", 0, back_reels, needs="IG feed video tapped = 1")
    c.step("IG Reels swipe back = 0", 0, swipes(1, up=False))

    def comments():
        for _ in range(2):
            ui.tap_node(need(by_id("comment_button"), "comment button", fallback=(1001, 1373))); ui.wait(2.5); ui.back(); ui.wait(2.5)
    c.step("IG comments open/close x2 = 0", 0, comments)

    def home_return():
        ui.home(); ui.wait(3); ui.launch(PKG); ui.wait(4)
    c.step("IG home and return = 0", 0, home_return)
    ads = sum("reason=ad" in l for l in c.log())
    c.results.append(("IG sponsored reel skipped", "PASS" if ads else "N/A", f"ad skips={ads}"))
    return c.results
