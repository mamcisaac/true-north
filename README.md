# True North

Hold your finger on the compass, physically point the top of your phone toward
a named real-world place, and release to lock your guess. The game computes the
true great-circle bearing from your location and scores how many degrees off
you were — five places per game, lowest average error wins.

- **Phone**: uses the device compass (`webkitCompassHeading` on iOS, absolute
  `deviceorientation` elsewhere) + geolocation. Both permissions ride the Start
  tap / first hold.
- **Desktop / no compass**: falls back to dragging the needle around the dial.

Part of the [Connect the Thoughts](https://connectthethoughts.ca/) arcade.
Static, no build step. Shared assets (`tokens.css`, `chrome.css`, `arcade.js`,
the topbar block) are vended from the hub repo — edit them there and run
`connectthethoughts/scripts/sync-shared.mjs`.
