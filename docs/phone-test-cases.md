# Phone test cases (real device)

Run these one by one on a real phone with the tester APK. "Count" is the platform's reel count
shown by the live badge / the Home tab mascot for that platform, relative to the start of the case.

**Setup for every case:** accessibility service ON, force-stop the target app, note the current
count (call it `N`), open the app fresh. A reel counts after it stays on screen ~0.75 s (the first
one included). Pause ~1.5 s after each swipe. Expected values below are the *increase* over `N`.

Legend: `[ ]` to do. **NOT VERIFIED ON EMULATOR** = not confirmed on the emulator harness, check
carefully.

## Instagram

- [ ] **IG-1** Reels tab, 2 swipes: open Reels tab, wait 1.5 s, swipe up, wait, swipe up, wait. → **+3**
- [ ] **IG-2** Swipe back: continue from IG-1, swipe down once, wait. → **+0**
- [ ] **IG-3** Profile reels: from a Reel tap the creator name, open their first reel, wait, swipe up once, wait. → **+2**
- [ ] **IG-4** Back to Reels tab: back out of the profile to the Reels tab on the same reel, wait 3 s. → **+0**
- [ ] **IG-5** Forward onto a seen reel: in the Reels tab swipe back one reel, then forward again to the seen reel. → **+0**
- [ ] **IG-6** Feed scrolling: Home tab, scroll the feed (no video tapped) for 10 s. → **+0**
- [ ] **IG-7** Feed video tapped: tap a feed video so the reel player opens, wait 1.5 s. → **+1**
- [ ] **IG-8** Feed player swipe 2: in that feed player swipe up twice, wait after each. → **+2**
- [ ] **IG-9** Back then Reels tab: close the feed player, open Reels tab on its previous reel, wait 3 s. → **+0**
- [ ] **IG-10** Reels swipe back: in the Reels tab swipe down once. → **+0**
- [ ] **IG-11** Comments x2: on a reel open comments, close, open again, close. → **+0**
- [ ] **IG-12** Home and return: press the Home button, return to Instagram on the same reel, wait 3 s. → **+0**
- [ ] **IG-13** Sponsored ad skipped: scroll Reels until an ad ("Sponsored" label) appears, stay 3 s, swipe on. Ad → **+0**, the next normal reel → **+1**. **NOT VERIFIED ON EMULATOR**

## YouTube

- [ ] **YT-1** Shorts tab, 2 swipes: open Shorts tab, wait, swipe up twice, wait after each. → **+3**
- [ ] **YT-2** Swipe back: swipe down once. → **+0**
- [ ] **YT-3** Comments x2: open and close comments twice on a Short. → **+0**
- [ ] **YT-4** Home and return: Home button, return to YouTube, wait 3 s. → **+0**
- [ ] **YT-5** Home shelf short: on YouTube Home tap a Short in the Shorts shelf (opens the player), wait. → **+1**
- [ ] **YT-6** Shelf player swipe: in that player swipe up once. → **+1**
- [ ] **YT-7** Back, Shorts tab again: close the player, open the Shorts tab on its previous short, wait 3 s. → **+0**
- [ ] **YT-8** Channel Shorts: open a channel's Shorts tab, tap the first short, wait, swipe up once. → **+2**. **NOT VERIFIED ON EMULATOR**
- [ ] **YT-9** Long video: play a normal (non-Short) video for 30 s. → **+0**
- [ ] **YT-10** Sponsored: scroll Shorts until an ad (Sponsored / Ad) appears, stay 3 s, swipe on. Ad → **+0**, next short → **+1**. **NOT VERIFIED ON EMULATOR**

## TikTok

- [ ] **TT-1** For You, 2 swipes: open For You, wait, swipe up twice, wait after each. → **+3**
- [ ] **TT-2** Swipe back: swipe down once. → **+0**
- [ ] **TT-3** Comments: open and close comments. → **+0**
- [ ] **TT-4** Home and return: Home button, return to TikTok, wait 3 s. → **+0**
- [ ] **TT-5** Friends tab and back: open Friends, return to For You on the same video, wait 3 s. → **+0**
- [ ] **TT-6** Forward over seen videos: from a few videos back, swipe forward over seen ones to a new video, wait. → **+1** (only the new one)
- [ ] **TT-7** Creator profile first video: tap a creator avatar/name, open their first video, wait. → **+1**. **NOT VERIFIED ON EMULATOR** (harness could not find the avatar)
- [ ] **TT-8** Profile player swipe: in that profile player swipe up once. → **+1**. **NOT VERIFIED ON EMULATOR**
- [ ] **TT-9** Back to For You: go back to For You on its previous video, wait 3 s. → **+0**. **NOT VERIFIED ON EMULATOR**
- [ ] **TT-10** Live: swipe onto a LIVE stream and stay 5 s. Record what happens (expected: not counted as a reel). **NOT VERIFIED ON EMULATOR**
- [ ] **TT-11** Sponsored: scroll For You until an ad appears, stay 3 s, swipe on. Ad → **+0**, next video → **+1**. **NOT VERIFIED ON EMULATOR**

## Facebook

- [ ] **FB-1** Reels row reel: on Home tap a reel in the Reels row, wait. → **+1**
- [ ] **FB-2** Row player swipes: swipe up twice in that player, wait after each. → **+2**
- [ ] **FB-3** Comment sheet x3: open and close the comment sheet three times. → **+0**
- [ ] **FB-4** Close, reopen another row reel: close the player, tap a different reel in the row, wait. → **+1**
- [ ] **FB-5** Feed video to player: tap a video in the feed so it opens the player, wait. → **+1**
- [ ] **FB-6** Feed player swipe 2: swipe up in the feed player (do it twice, wait after each). → **+1** in total (verified behaviour: only 1 counted)
- [ ] **FB-7** Feed player swipe 3: swipe up three times in a feed player. → **+1** in total
- [ ] **FB-8** Reels tab watch: open the Reels tab, wait. → **+1**
- [ ] **FB-9** Reels tab swipe: swipe up once. → **+1**
- [ ] **FB-10** Home, open a feed player: go Home, open a feed player. → **+1**
- [ ] **FB-11** Back, Reels tab again: back from the feed player, open the Reels tab on the same reel, wait 3 s. → **+0** (failed once on the emulator; verify the same reel is not recounted)
- [ ] **FB-12** Home and return: Home button, return to Facebook on the same reel, wait 3 s. → **+0**
- [ ] **FB-13** Sponsored: scroll the Reels tab until a "Sponsored" reel appears, stay 3 s, swipe on. Ad → **+0**, next → **+1**. **NOT VERIFIED ON EMULATOR**

## Snapchat (Spotlight) — everything here is NOT VERIFIED ON EMULATOR

Snapchat blocked emulator logins, so none of this was run anywhere. Detection assumes the
`spotlight_container` view id and a RecyclerView/ViewPager pager; if counts are wrong, run
"capture layout" on the debug screen while on Spotlight and send the capture.

- [ ] **SC-1** Open Spotlight, 2 swipes: open the Spotlight tab, wait 1.5 s, swipe up twice, wait after each. → **+3**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-2** Swipe back: swipe down once. → **+0**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-3** Comments open/close: open and close the comments sheet on a snap. → **+0**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-4** Home and return: Home button, return to Snapchat on the same snap, wait 3 s. → **+0**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-5** Same snap without moving: leave Spotlight to another tab and return to the same snap without swiping, wait 3 s. → **+0**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-6** Another creator's profile snap: tap a creator on a snap and open one of their Spotlight snaps, wait. → **+1**. **NOT VERIFIED ON EMULATOR**
- [ ] **SC-7** Sponsored skipped: scroll Spotlight until an ad ("Sponsored" / "Ad") appears, stay 3 s, swipe on. Ad → **+0**, next snap → **+1**. **NOT VERIFIED ON EMULATOR**
