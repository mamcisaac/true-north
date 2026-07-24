# As the Crow Flies
Formerly "True North" — the slug and URL remain `true-north`.

Lay your phone flat and turn to aim. The game silently reads the device
compass — but never shows you north. A real place is named: the on-screen
needle stays pointing up — you physically turn yourself and the phone until it
points where you think the place lies. Your guess bearing is the live compass
heading the moment you lock. Then set a distance (0–20,000 km — the antipodal
max, past which a throw just comes back the other way) and throw. A canvas globe —
oriented the way your phone is physically facing — shows your dart flying a
great circle for your chosen bearing and distance, then measures how far it
landed from the true spot. The daily ranks by **total distance from the target**
in km across five places (lower is better) — measured along the globe, as the crow flies. Free play
keeps a classic points score: up to 1000 per round (exponential falloff by
landing gap), five rounds, 5000 max.

- **Phone**: device compass (`webkitCompassHeading` on iOS, absolute
  `deviceorientation` elsewhere) + geolocation, both prompted on the Start tap.
  The heading is captured live at the moment you lock — the phone turns freely
  while you aim. Android heading is magnetic north (declination uncorrected) — accepted approximation.
- **Desktop / no compass**: fully playable; drag the on-screen needle and the
  top of the screen counts as north. `?heading=NN` simulates a heading; in that
  mode dragging the dial rotates the simulated heading (as if physically turning
  the phone).
- **Globe**: hand-rolled canvas-2D orthographic projection (`arcade-globe.js`,
  vended from the hub — shared with other arcade games), no dependencies. Land
  polygons and admin-0 country borders are Natural Earth 110m (public domain)
  via world-atlas@2, vendored as `world-land.js` and `world-borders.js`. The dart flies a
  great circle for your chosen bearing and distance. The reveal camera rides the throw
  from the start (bearing pointing up, flight reads straight while the globe turns beneath);
  on landing it zooms out and spins to a north-up rest view where the entire great circle
  is drawn faint and dashed, the flown segment solid on the same ring, and the landing–target
  gap (as the crow flies) is captioned. After landing, drag the globe to explore.

Part of the [Connect the Thoughts](https://connectthethoughts.ca/) arcade.
Static, no build step. Shared assets (`tokens.css`, `chrome.css`, `arcade-theme.js`,
the topbar block) are vended from the hub repo — edit them there and run
`connectthethoughts/scripts/sync-shared.mjs`.
