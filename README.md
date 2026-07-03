# True North

Lay your phone flat and don't move it. The game silently reads the device
compass — but never shows you north. A real place is named: spin the on-screen
needle toward where you think it lies (your guess bearing = device heading +
needle angle), lock it, set a distance (0–40,000 km), and throw. A canvas
globe — oriented the way your phone is physically facing — shows your dart
flying the great-circle path for your chosen bearing and distance, then
measures how far it landed from the true spot. Up to 1000 points per round
(exponential falloff by landing gap), five rounds per game, 5000 max.

- **Phone**: device compass (`webkitCompassHeading` on iOS, absolute
  `deviceorientation` elsewhere) + geolocation, both prompted on the Start tap.
  The heading is frozen at the moment you lock your direction. Android heading
  is magnetic north (declination uncorrected) — accepted approximation.
- **Desktop / no compass**: fully playable; the top of the screen counts as
  north. `?heading=NN` fakes a device heading for testing the globe
  orientation math.
- **Globe**: hand-rolled canvas-2D orthographic projection (`globe.js`), no
  dependencies. Land polygons are Natural Earth 110m (public domain) via
  world-atlas@2, converted to `world-land.js` at vendoring time.

Part of the [Connect the Thoughts](https://connectthethoughts.ca/) arcade.
Static, no build step. Shared assets (`tokens.css`, `chrome.css`, `arcade.js`,
the topbar block) are vended from the hub repo — edit them there and run
`connectthethoughts/scripts/sync-shared.mjs`.
