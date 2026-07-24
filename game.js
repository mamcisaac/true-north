// As the Crow Flies (slug: true-north) — hold your phone flat, physically turn
// to point it toward a real place, pick a distance, and throw a dart around the
// globe.
//
// The device compass is read silently: north is NEVER shown. The needle is
// FIXED pointing up; turning the phone IS the aiming. The guess bearing is the
// LIVE compass heading captured the moment the player taps Lock (needle angle is
// 0, so bearing = heading). The phone may turn freely while aiming.
//
// No compass (desktop, or permission denied): the needle drags instead, the top
// of the screen counts as north, and bearing = needle angle. Same game, minus
// the physical twist. ?heading=NN simulates a heading for desktop testing —
// dragging the dial rotates the simulated heading.
(function () {
  'use strict';

  // Phones have no console — surface any uncaught error on the page so
  // "it doesn't work" is at least diagnosable.
  window.addEventListener('error', function (e) {
    var el = document.getElementById('mode-note');
    if (el) el.textContent = 'Something broke: ' + (e.message || 'unknown error');
  });

  // ── Places (name, lat, lon, emoji) ─────────────────────────────────────────
  var PLACES = [
    ['Tokyo', 35.68, 139.69, '🗼'], ['Paris', 48.86, 2.35, '🗼'],
    ['London', 51.51, -0.13, '🎡'], ['New York City', 40.71, -74.01, '🗽'],
    ['Sydney', -33.87, 151.21, '🎭'], ['Cairo', 30.04, 31.24, '🐪'],
    ['Rio de Janeiro', -22.91, -43.17, '⛰️'], ['Moscow', 55.76, 37.62, '🏰'],
    ['Beijing', 39.90, 116.41, '🏮'], ['Mumbai', 19.08, 72.88, '🌶️'],
    ['Cape Town', -33.92, 18.42, '⛰️'], ['Mexico City', 19.43, -99.13, '🌮'],
    ['Vancouver', 49.28, -123.12, '🏔️'], ['Honolulu', 21.31, -157.86, '🌺'],
    ['Reykjavik', 64.15, -21.94, '🌋'], ['Istanbul', 41.01, 28.98, '🕌'],
    ['Bangkok', 13.76, 100.50, '🛺'], ['Singapore', 1.35, 103.82, '🦁'],
    ['Nairobi', -1.29, 36.82, '🦒'], ['Buenos Aires', -34.60, -58.38, '💃'],
    ['Lima', -12.05, -77.04, '🦙'], ['Anchorage', 61.22, -149.90, '🐻'],
    ['Dublin', 53.35, -6.26, '☘️'], ['Rome', 41.90, 12.50, '🏛️'],
    ['Athens', 37.98, 23.73, '🏛️'], ['Madrid', 40.42, -3.70, '🥘'],
    ['Lisbon', 38.72, -9.14, '🚋'], ['Amsterdam', 52.37, 4.90, '🚲'],
    ['Berlin', 52.52, 13.40, '🐻'], ['Vienna', 48.21, 16.37, '🎻'],
    ['Stockholm', 59.33, 18.07, '🛶'], ['Helsinki', 60.17, 24.94, '🧖'],
    ['Oslo', 59.91, 10.75, '⛷️'], ['Warsaw', 52.23, 21.01, '🧜'],
    ['Seoul', 37.57, 126.98, '🥢'], ['Shanghai', 31.23, 121.47, '🌃'],
    ['Hong Kong', 22.32, 114.17, '⛴️'], ['Manila', 14.60, 120.98, '🏝️'],
    ['Jakarta', -6.21, 106.85, '🌋'], ['Auckland', -36.85, 174.76, '🥝'],
    ['Fiji', -17.71, 178.07, '🏝️'], ['Tahiti', -17.65, -149.43, '🌴'],
    ['Santiago', -33.45, -70.67, '🍇'], ['Bogotá', 4.71, -74.07, '☕'],
    ['Havana', 23.11, -82.37, '🚗'], ['Kingston, Jamaica', 18.02, -76.80, '🎵'],
    ['Miami', 25.76, -80.19, '🦩'], ['New Orleans', 29.95, -90.07, '🎺'],
    ['Chicago', 41.88, -87.63, '🌭'], ['Denver', 39.74, -104.99, '🏔️'],
    ['Los Angeles', 34.05, -118.24, '🎬'], ['San Francisco', 37.77, -122.42, '🌉'],
    ['Seattle', 47.61, -122.33, '☕'], ['Las Vegas', 36.17, -115.14, '🎰'],
    ['Toronto', 43.65, -79.38, '🏒'], ['Winnipeg', 49.90, -97.14, '🌾'],
    ['Calgary', 51.05, -114.07, '🤠'], ["St. John's, Newfoundland", 47.56, -52.71, '🐋'],
    ['Iqaluit', 63.75, -68.52, '❄️'], ['Whitehorse', 60.72, -135.06, '🐺'],
    ['the North Pole', 90.0, 0.0, '🧭'], ['the pyramids of Giza', 29.98, 31.13, '🔺'],
    ['the Eiffel Tower', 48.858, 2.294, '🗼'], ['the Taj Mahal', 27.175, 78.042, '🕌'],
    ['the Great Wall of China', 40.43, 116.57, '🧱'], ['Machu Picchu', -13.16, -72.55, '🏔️'],
    ['the Grand Canyon', 36.10, -112.11, '🏜️'], ['Niagara Falls', 43.08, -79.07, '💦'],
    ['Mount Everest', 27.99, 86.93, '🏔️'], ['the Amazon rainforest', -3.47, -62.37, '🦜'],
    ['the Sahara Desert', 23.42, 12.62, '🏜️'], ['the Serengeti', -2.33, 34.83, '🦁'],
    ['Victoria Falls', -17.92, 25.86, '💦'], ['the Great Barrier Reef', -18.29, 147.70, '🐠'],
    ['Uluru', -25.34, 131.04, '🪨'], ['Stonehenge', 51.18, -1.83, '🪨'],
    ['the Colosseum', 41.89, 12.49, '🏟️'], ['the Statue of Liberty', 40.69, -74.04, '🗽'],
    ['the Golden Gate Bridge', 37.82, -122.48, '🌉'], ['Chichén Itzá', 20.68, -88.57, '🛕'],
    ['Easter Island', -27.11, -109.35, '🗿'], ['the Galápagos Islands', -0.95, -90.97, '🐢'],
    ['Petra', 30.33, 35.44, '🏛️'], ['the Kremlin', 55.75, 37.62, '🏰'],
    ['Mecca', 21.39, 39.86, '🕋'], ['Jerusalem', 31.77, 35.22, '🕍'],
    ['Timbuktu', 16.77, -3.01, '📜'], ['Antarctica (South Pole)', -90.0, 0.0, '🐧'],
    ['Greenland', 72.0, -40.0, '🧊'], ['Madagascar', -18.77, 46.87, '🦎'],
    ['Mount Fuji', 35.36, 138.73, '🗻'], ['the Panama Canal', 9.08, -79.68, '🚢'],
    ['the Bermuda Triangle', 25.0, -71.0, '🌀'], ['Loch Ness', 57.32, -4.42, '🦕'],
    ['Montreal', 45.50, -73.57, '🥯'], ['Quebec City', 46.81, -71.21, '🏰'],
    ['Ottawa', 45.42, -75.70, '🍁'], ['Halifax', 44.65, -63.58, '⚓'],
    ['Yellowknife', 62.45, -114.37, '🌌'], ['Boston', 42.36, -71.06, '🦞'],
    ['Washington, D.C.', 38.90, -77.04, '🏛️'], ['Houston', 29.76, -95.37, '🚀'],
    ['Nashville', 36.16, -86.78, '🎸'], ['Kyiv', 50.45, 30.52, '🌻'],
    ['Prague', 50.08, 14.44, '🍺'], ['Budapest', 47.50, 19.04, '🌉'],
    ['Zurich', 47.37, 8.54, '🧀'], ['Copenhagen', 55.68, 12.57, '⛵'],
    ['Edinburgh', 55.95, -3.19, '🏰'], ['Barcelona', 41.39, 2.17, '⚽'],
    ['Marrakesh', 31.63, -7.99, '🧞'], ['Lagos', 6.52, 3.38, '🎶'],
    ['Accra', 5.56, -0.20, '🥁'], ['Dakar', 14.72, -17.47, '🐟'],
    ['Addis Ababa', 9.02, 38.75, '☕'], ['Kinshasa', -4.32, 15.31, '🦍'],
    ['Johannesburg', -26.20, 28.05, '💎'], ['Dubai', 25.20, 55.27, '🌆'],
    ['Riyadh', 24.71, 46.68, '🏜️'], ['Tehran', 35.69, 51.39, '🧿'],
    ['Baghdad', 33.31, 44.37, '📚'], ['Kabul', 34.53, 69.17, '🏔️'],
    ['Samarkand', 39.65, 66.96, '🕌'], ['Almaty', 43.24, 76.89, '🍎'],
    ['Ulaanbaatar', 47.89, 106.91, '🐎'], ['Kathmandu', 27.72, 85.32, '🛕'],
    ['New Delhi', 28.61, 77.21, '🪷'], ['Colombo', 6.93, 79.86, '🍵'],
    ['Dhaka', 23.81, 90.41, '🐅'], ['Yangon', 16.87, 96.20, '🛕'],
    ['Hanoi', 21.03, 105.85, '🍜'], ['Ho Chi Minh City', 10.82, 106.63, '🛵'],
    ['Kuala Lumpur', 3.14, 101.69, '🏙️'], ['Taipei', 25.03, 121.57, '🧋'],
    ['Osaka', 34.69, 135.50, '🍣'], ['Sapporo', 43.06, 141.35, '⛄'],
    ['Perth', -31.95, 115.86, '🦘'], ['Melbourne', -37.81, 144.96, '🎾'],
    ['Brisbane', -27.47, 153.03, '🐨'], ['Wellington', -41.29, 174.78, '💨'],
    ['São Paulo', -23.55, -46.63, '🏙️'], ['Quito', -0.18, -78.47, '🌋'],
    ['La Paz', -16.49, -68.15, '🚡'], ['Montevideo', -34.90, -56.16, '🧉'],
    ['San José, Costa Rica', 9.93, -84.08, '🦥'], ['Nuuk', 64.18, -51.72, '🛷'],
    ['Angel Falls', 5.97, -62.54, '💦'], ['Iguazú Falls', -25.69, -54.44, '💦'],
    ['the Matterhorn', 45.98, 7.66, '⛰️'], ['Angkor Wat', 13.41, 103.87, '🛕'],
    ['the Dead Sea', 31.50, 35.49, '🧂'], ['Mount Kilimanjaro', -3.07, 37.35, '⛰️'],
    ['Lake Baikal', 53.5, 108.0, '💧'], ['the Gobi Desert', 42.5, 103.5, '🏜️'],
    ['the Faroe Islands', 62.0, -6.9, '🐑'], ['Svalbard', 78.22, 15.65, '🐻‍❄️'],
    ['the Azores', 37.74, -25.67, '🐬'], ['Bali', -8.34, 115.09, '🏄'],
    ['the Maldives', 4.17, 73.51, '🤿'], ['the Strait of Gibraltar', 35.95, -5.60, '🐒'],
    ['the Cape of Good Hope', -34.36, 18.47, '⛵'], ['Cape Horn', -55.98, -67.27, '🌊'],
    ['the Okavango Delta', -19.28, 22.79, '🐘'], ['Zanzibar', -6.16, 39.19, '🌶️'],
    ['the Namib Desert', -24.5, 15.5, '🦂'], ['the Canary Islands', 28.29, -16.63, '🐤'],
    ['Bora Bora', -16.50, -151.74, '🏝️'], ['Mount Vesuvius', 40.82, 14.43, '🌋'],
    ['the Leaning Tower of Pisa', 43.72, 10.40, '🗼'], ['the Terracotta Army', 34.38, 109.28, '🏺'],
    ['the Suez Canal', 30.46, 32.35, '🚢'], ['the Falkland Islands', -51.7, -59.2, '🐧'],
  ];

  var ROUNDS = 5;
  var MIN_KM = 100; // bearings to very nearby targets are unstable — skip them
  // The slider ceiling. The true antipodal max is π·R ≈ 20,015 km, but we cap
  // on the 25 km snap grid at a clean 20,000 — matching every piece of player
  // copy — so no call site needs to clamp a rounded value back under the max.
  var MAX_KM = 20000;

  // ── Geometry ────────────────────────────────────────────────────────────────
  // Great-circle geodesy (distanceKm / bearingTo / destination) and the Earth
  // constants live in the shared globe (window.ArcadeGlobe) and are called
  // directly at the use sites — this game keeps NO local haversine. Note
  // MAX_KM above is a deliberate PRODUCT cap, not the physical maximum; that
  // one is ArcadeGlobe.HALF_LAP_KM (π·R ≈ 20,015 km).
  // `R` here is only deg→rad for the compass/needle screen trig, which is this
  // game's own UI math.
  var R = Math.PI / 180;
  function fmtKm(km) { return Math.round(km).toLocaleString(); }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  var compassEl, needleYou, ticksEl, globe;
  var cardDeg = null;        // continuous, unwrapped display heading (deg)

  // Old cached globe.js builds may predate setInteractive — never hard-crash on it.
  function setGlobeInteractive(on) {
    if (globe && globe.setInteractive) globe.setInteractive(on);
  }

  // ── Heading source ──────────────────────────────────────────────────────────
  // The compass is read continuously but only USED at the moment of lock.
  // A circular mean of recent samples smooths sensor jitter. Note: on Android
  // the heading is magnetic, not true (declination is uncorrected — up to
  // ~15-25° near the poles); iOS webkitCompassHeading is true heading when
  // Location Services are on. Accepted approximation: the distance guess
  // dominates the error budget.
  var sensor = {
    hasCompass: false,
    listening: false,
    sinSum: 0, cosSum: 0, samples: [],
    fake: null,          // ?heading=NN test override
  };

  function pushHeading(h) {
    sensor.hasCompass = true;
    var rad = h * R;
    sensor.samples.push(rad);
    sensor.sinSum += Math.sin(rad);
    sensor.cosSum += Math.cos(rad);
    if (sensor.samples.length > 20) {
      var old = sensor.samples.shift();
      sensor.sinSum -= Math.sin(old);
      sensor.cosSum -= Math.cos(old);
    }
  }
  function currentHeading() {
    if (sensor.fake != null) return sensor.fake;
    if (!sensor.hasCompass) return 0; // top of screen counts as north
    return ((Math.atan2(sensor.sinSum, sensor.cosSum) / R) + 360) % 360;
  }

  // Point mode: the player aims by physically turning the phone. True when a real
  // compass is reporting OR a fake heading is simulated (?heading=NN). Fallback
  // mode (needle-drag) is the negation.
  function pointMode() { return sensor.hasCompass || sensor.fake != null; }

  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      pushHeading(e.webkitCompassHeading); // iOS
    } else if (e.alpha != null && (e.absolute || sensor.hasCompass)) {
      var screenA = (screen.orientation && screen.orientation.angle) || 0;
      pushHeading((360 - e.alpha + screenA) % 360); // Android
    }

    // ── Live aim feedback ──
    if (!state || state.phase !== 'aim') return;
    // Boot race: first real sample arrived after a fallback-latched round opened.
    if (!state.pointMode && sensor.hasCompass) {
      state.pointMode = true;
      applyAimModeUI();
    }
    if (state.pointMode && sensor.fake == null) {
      renderCompassCard(currentHeading());     // stream headings onto the card
    }
  }

  // Must be called from a user gesture (iOS permission prompt).
  function startSensors() {
    if (sensor.listening) return Promise.resolve();
    sensor.listening = true;
    var attach = function () {
      window.addEventListener('deviceorientationabsolute', onOrientation, true);
      window.addEventListener('deviceorientation', onOrientation, true);
    };
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      return DeviceOrientationEvent.requestPermission()
        .then(function (state) { if (state === 'granted') attach(); })
        .catch(function () { /* no compass — top of screen is north */ });
    }
    attach();
    return Promise.resolve();
  }

  // ── Game state ──────────────────────────────────────────────────────────────
  // phase: idle | locating | aim | distance | reveal | score | final
  var state = null;
  // { origin, targets, idx, scores:[], needleAngle, headingAtLock,
  //   bearing, distKm, landing, gapKm, points }

  function pickTargets(origin) {
    var pool = PLACES.filter(function (p) {
      return ArcadeGlobe.distanceKm(origin.lat, origin.lon, p[1], p[2]) >= MIN_KM;
    });
    var a = pool.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, ROUNDS);
  }

  // ── Daily targets ────────────────────────────────────────────────────────────
  // The DAILY serves the SAME five places to everyone that day (origin stays the
  // player's real location, so the true bearing/distance still differ per player —
  // that's the game). Deterministic: seed a PRNG from the shared daily date key
  // (archive-aware via ArcadeDailySeed) salted with the game slug, shuffle the
  // full PLACES list, take five. No origin-distance filter — that would make the
  // list differ per player and break the shared board.
  function pickDailyTargets() {
    var DS = window.ArcadeDailySeed;
    var rnd = DS.mulberry32(DS.seedFromKey(DS.dailyDateKey(), 'true-north'));
    var a = PLACES.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, ROUNDS);
  }

  // ── Mode + shared leaderboard glue ───────────────────────────────────────────
  // gameMode: 'daily' (seeded, shared board, scored) | 'free' (random, unscored).
  // Boot into Daily (arcade daily convention).
  var gameMode = 'daily';
  var LB = window.ArcadeLeaderboard || null;
  var LB_GAME = 'true-north';
  var lbHandle = LB && LB.loadSharedHandle ? LB.loadSharedHandle(LB_GAME) : '';
  var lbUi = null; // shared modal, built at boot when the backend is configured

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // Archive-aware daily board key: "YYYY-M-D|daily" for (played day − offset).
  function boardKeyForOffset(offset) {
    var d = window.ArcadeDailySeed.dailyDate();
    d.setDate(d.getDate() - offset);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '|daily';
  }

  // The ranked metric is TOTAL DISTANCE from the target in km (lower is better).
  // Distance is measured along the surface of the globe, so it's immune to the
  // bearing quirk where an aim 180° "off" can still land dead on target by going
  // the other way around the world.
  function totalKm() {
    return state ? Math.round(state.gapErrors.reduce(function (s, x) { return s + x; }, 0)) : 0;
  }
  // Map a board row / history entry onto its km value (for compare + display).
  function lbVal(e) {
    if (!e) return Infinity;
    if (e.km != null) return e.km;
    if (e.degrees != null) return Infinity; // v1 bearing-error entry — not comparable to km
    if (e.value != null) return e.value;
    return Infinity;
  }
  function lbRowKm(r) {
    var m = r.meta || {};
    if (m.km != null) return Math.round(m.km);
    if (m.degrees != null) return null;
    return Math.round(Number(r.score));
  }
  function lbBestKm(best) {
    return Math.round(best.km != null ? best.km : (best.value != null ? best.value : 0));
  }
  function lbCell(km) { return fmtKm(km) + ' km'; }

  // ── Scoring ─────────────────────────────────────────────────────────────────
  function scoreFor(gapKm) {
    if (gapKm <= 25) return 1000;
    return Math.round(1000 * Math.exp(-gapKm / 2000));
  }
  function tierFor(points) {
    if (points >= 700) return 'good';
    if (points >= 300) return 'warn';
    return 'bad';
  }
  function verdictText(points) {
    if (points >= 1000) return 'BULLSEYE!';
    if (points >= 700)  return 'So close!';
    if (points >= 450)  return 'Nice throw.';
    if (points >= 300)  return 'Getting warm.';
    if (points >= 100)  return 'Wide of the mark.';
    return 'Wrong side of the world!';
  }
  // Daily headline metric is distance from the target in km (lower is better) —
  // its own tier + phrasing so what the player sees matches the leaderboard.
  function tierForKm(km) {
    if (km <= 500) return 'good';
    if (km <= 2500) return 'warn';
    return 'bad';
  }
  function verdictTextKm(km) {
    if (km <= 25)   return 'BULLSEYE!';
    if (km <= 250)  return 'Dead on.';
    if (km <= 750)  return 'So close!';
    if (km <= 2000) return 'Good throw.';
    if (km <= 5000) return 'Wide of the mark.';
    return 'Wrong side of the world!';
  }

  // ── Panels / phases ─────────────────────────────────────────────────────────
  function showPhase(phase) {
    $('panel-aim').hidden = phase !== 'aim';
    $('panel-distance').hidden = phase !== 'distance';
    $('panel-reveal').hidden = phase !== 'reveal' && phase !== 'score';
    $('result').hidden = phase !== 'score' && phase !== 'final';
    $('skip-hint').hidden = phase !== 'reveal';
    $('target-card').hidden = phase === 'final';
  }

  function totalScore() {
    return state ? state.scores.reduce(function (s, x) { return s + x; }, 0) : 0;
  }
  // Daily HUD shows running distance from target in km (lower is better, matching
  // the leaderboard); free play keeps the native 0–5000 points score.
  function statusLabelHtml(mode, valueStr) {
    return mode === 'daily'
      ? 'Off by <b id="score-total">' + valueStr + '</b> km'
      : 'Score <b id="score-total">' + valueStr + '</b> / 5000';
  }
  function refreshStatus() {
    $('round-num').textContent = state ? String(state.idx + 1) : '–';
    var mode = state ? state.mode : gameMode;
    var valueStr = state ? (mode === 'daily' ? fmtKm(totalKm()) : String(totalScore())) : '–';
    $('score-label').innerHTML = statusLabelHtml(mode, valueStr);
  }

  function showRound() {
    setGlobeInteractive(false);
    var t = state.targets[state.idx];
    state.pointMode = pointMode();               // latch mode for this round

    if (state.pointMode) {
      state.needleAngle = 0;                      // needle fixed up; phone does the aiming
      setNeedle(0);
    } else {
      // Fallback: round 1 starts at a random angle (no anchor hint); later rounds
      // keep the prior needle since the flat phone's heading is unchanged.
      if (state.idx === 0) state.needleAngle = Math.floor(Math.random() * 360);
      setNeedle(state.needleAngle);
    }

    $('target-kicker').textContent = 'Which way to…';
    $('target-name').textContent = t[3] + ' ' + t[0];
    $('tn-next-btn').hidden = true;
    $('tn-again-btn').hidden = true;
    applyAimModeUI();                             // sets target-sub, mode-note, nudges, classes, card
    refreshStatus();
    showPhase('aim');
  }

  // Sets the aim panel's copy, control visibility, and compass classes for the
  // current round's mode. Called once per round (showRound) and again live if
  // a real compass shows up mid-round (onOrientation boot-race upgrade).
  function applyAimModeUI() {
    var point = state.pointMode;

    $('aim-minus').hidden = point;
    $('aim-plus').hidden  = point;

    compassEl.classList.toggle('point-mode', point);
    compassEl.classList.remove('is-aiming');

    compassEl.setAttribute('aria-label', point
      ? 'Compass — point your phone toward the target, then lock'
      : 'Compass — drag the needle to aim');
    $('hold-hint').textContent = point ? 'Point your phone' : 'Drag the needle';

    $('target-sub').textContent = point
      ? 'Point your phone at it, then lock it in'
      : 'Spin the needle, then lock it in';

    $('mode-note').textContent = point
      ? 'Keep it flat — turn yourself and the phone to aim.'
      : 'No compass — the top of the screen counts as north.';

    if (point) {
      state.needleAngle = 0;                 // needle is fixed up — a stale fallback
      setNeedle(0);                          // angle must never leak into the bearing
      // cardDeg is NOT reset: the unwrap in renderCompassCard keeps the ring's
      // DOM angle continuous across rounds, so this re-sync animates the short
      // way instead of whipping a near-full turn through the CSS transition.
      renderCompassCard(currentHeading());
    } else {
      ticksEl.style.transform = 'none';      // fallback never rotates the card
    }
  }

  // Counter-rotate the anonymous tick ring by -heading so the card reads as
  // world-fixed while the fixed needle (the phone) sweeps over it. Ticks are
  // uniform/unlabelled, so north is still never revealed.
  function renderCompassCard(h) {
    if (cardDeg == null) {
      cardDeg = h;                                     // first sample: snap, no spin
    } else {
      var delta = ((h - (cardDeg % 360)) + 540) % 360 - 180; // shortest-path unwrap
      cardDeg += delta;                                // avoids 359°→1° backspin
    }
    ticksEl.style.transform = 'rotate(' + (-cardDeg) + 'deg)';
  }

  // ── AIM: drag the needle (screen-relative; north never shown) ──────────────
  function setNeedle(deg) {
    needleYou.style.transform = 'rotate(' + deg + 'deg)';
  }
  function dialAngleFromEvent(ev) {
    var r = compassEl.getBoundingClientRect();
    var dx = ev.clientX - (r.left + r.width / 2);
    var dy = ev.clientY - (r.top + r.height / 2);
    return (Math.atan2(dx, -dy) / R + 360) % 360;
  }
  function installAimHandlers() {
    var dragging = false, dragStartDial = 0, dragStartFake = 0;

    compassEl.addEventListener('pointerdown', function (ev) {
      if (!state || state.phase !== 'aim') return;
      ev.preventDefault();

      if (state.pointMode) {
        if (sensor.fake != null) {
          // TEST MODE: the phone can't physically turn, so dragging the dial
          // rotates the SIMULATED heading. Needle stays up; ticks counter-rotate.
          dragging = true;
          dragStartDial = dialAngleFromEvent(ev);
          dragStartFake = sensor.fake;
          compassEl.classList.add('is-aiming');
          try { compassEl.setPointerCapture(ev.pointerId); } catch (_) {}
        }
        return; // real compass point mode: dial is inert
      }

      // FALLBACK: existing needle-drag (unchanged)
      try { compassEl.setPointerCapture(ev.pointerId); } catch (_) { /* stale pointer */ }
      dragging = true;
      compassEl.classList.add('is-aiming');
      state.needleAngle = dialAngleFromEvent(ev);
      setNeedle(state.needleAngle);
    });
    compassEl.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      if (state.pointMode) {
        // Only the ?heading test mode drags here. A fallback drag caught by the
        // boot-race upgrade lands in this branch too — it must NOT write
        // sensor.fake, or a real compass gets hijacked into fake mode for good.
        if (sensor.fake == null) { endDrag(); return; }
        var cur = dialAngleFromEvent(ev);
        var delta = cur - dragStartDial;                 // screen degrees dragged
        sensor.fake = ((dragStartFake + delta) % 360 + 360) % 360;
        renderCompassCard(currentHeading());              // == sensor.fake
        return;
      }
      state.needleAngle = dialAngleFromEvent(ev);
      setNeedle(state.needleAngle);
    });
    function endDrag() {
      dragging = false;
      compassEl.classList.remove('is-aiming');
      // Releasing does NOT lock — the needle stays; only the button commits.
    }
    compassEl.addEventListener('pointerup', endDrag);
    compassEl.addEventListener('pointercancel', endDrag);
  }

  // Press-and-hold auto-repeat for nudge buttons.
  function holdRepeat(btn, fn) {
    var timer = null, started = 0;
    function fire() {
      fn(Date.now() - started > 1200 ? 10 : 1); // accelerate after 1.2 s
    }
    btn.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      started = Date.now();
      fire();
      timer = setInterval(fire, 90);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
      btn.addEventListener(evt, function () { if (timer) { clearInterval(timer); timer = null; } });
    });
  }

  function nudgeAim(dir) {
    return function (mult) {
      if (!state || state.phase !== 'aim' || state.pointMode) return;
      state.needleAngle = (state.needleAngle + dir * mult + 360) % 360;
      setNeedle(state.needleAngle);
    };
  }

  function lockDirection() {
    if (!state || state.phase !== 'aim') return;
    var h = currentHeading();
    if (state.pointMode && sensor.fake == null && !sensor.hasCompass) {
      $('mode-note').textContent = 'Hold on — finding the compass. Point your phone and try again.';
      return; // do not advance; no heading captured yet
    }
    state.headingAtLock = h;
    state.bearing = (state.headingAtLock + state.needleAngle) % 360;
    state.phase = 'distance';
    $('target-kicker').textContent = 'How far to…';
    $('target-sub').textContent = 'Set the distance, then throw';
    showPhase('distance');
    refreshDistance();
  }

  // ── DISTANCE: linear slider ────────────────────────────────────────────────
  // Slider 0-1000 maps straight to 0-MAX_KM, so equal drags cover equal distance
  // anywhere on the track — no warping, and no dead zone past the far side of the
  // Earth (MAX_KM is the antipodal distance, the farthest a throw can matter).
  function sliderToKm(v) {
    return (v / 1000) * MAX_KM;
  }

  function refreshDistance() {
    $('distance-km').textContent = fmtKm(state.distKm);
  }
  function onSlider() {
    if (!state) return;
    state.distKm = Math.round(sliderToKm(Number($('distance-slider').value)) / 25) * 25;
    refreshDistance();
  }
  function nudgeDist(dir) {
    return function (mult) {
      if (!state || state.phase !== 'distance') return;
      state.distKm = Math.min(MAX_KM, Math.max(0, state.distKm + dir * 25 * mult));
      refreshDistance();
    };
  }

  // ── THROW → REVEAL ──────────────────────────────────────────────────────────
  function throwDart() {
    if (!state || state.phase !== 'distance') return;
    setGlobeInteractive(false);
    var t = state.targets[state.idx];
    state.landing = ArcadeGlobe.destination(state.origin.lat, state.origin.lon, state.bearing, state.distKm);
    // Ranked metric: how far the dart landed from the target, along the globe.
    state.gapKm = ArcadeGlobe.distanceKm(state.landing.lat, state.landing.lon, t[1], t[2]);
    state.points = scoreFor(state.gapKm);
    state.phase = 'reveal';
    $('target-kicker').textContent = 'The throw…';
    $('target-sub').textContent = '';
    showPhase('reveal');

    globe.playReveal({
      origin: state.origin,
      // LIVE heading, not the lock-frozen one: in point mode the player may
      // have turned since locking, and phase 1's "the globe matches your
      // phone" must be true of the phone as held NOW. The bearing stays the
      // locked value; phase 2 rotates from current facing to the throw.
      // (Fallback/no-compass: currentHeading() is 0 — identical to before.)
      heading: currentHeading(),
      bearing: state.bearing,
      distKm: state.distKm,
      landing: state.landing,
      target: { lat: t[1], lon: t[2], emoji: t[3], name: t[0] },
      gapKm: state.gapKm,
      tier: tierFor(state.points)
    }, {
      caption: function (text) { $('globe-caption').textContent = text; },
      done: function () { showScore(); }
    });
  }

  function showScore() {
    if (!state || state.phase !== 'reveal') return;
    state.phase = 'score';
    state.scores.push(state.points);
    state.gapErrors.push(state.gapKm);
    var t = state.targets[state.idx];
    var daily = state.mode === 'daily';
    var tier = daily ? tierForKm(state.gapKm) : tierFor(state.points);

    if (daily) {
      // Headline = the ranked metric (distance from the target).
      $('verdict').textContent = verdictTextKm(state.gapKm) + ' ' +
        fmtKm(state.gapKm) + ' km off';
      $('result-detail').textContent =
        'Your dart landed ' + fmtKm(state.gapKm) + ' km from ' + t[0] + ', as the crow flies.';
    } else {
      $('verdict').textContent = verdictText(state.points) + ' +' + state.points +
        (state.points === 1 ? ' point' : ' points');
      var gcKm = ArcadeGlobe.distanceKm(state.origin.lat, state.origin.lon, t[1], t[2]);
      $('result-detail').textContent =
        'Your dart landed ' + fmtKm(state.gapKm) + ' km from ' + t[0] + ', as the crow flies. ' +
        '(True answer: ' + fmtKm(gcKm) + ' km, starting bearing ' +
        Math.round(ArcadeGlobe.bearingTo(state.origin.lat, state.origin.lon, t[1], t[2])) + '°.)';
    }
    $('verdict').className = 'tn-verdict ' + tier;
    refreshStatus();
    showPhase('score');

    if (state.idx + 1 < ROUNDS) {
      $('tn-next-btn').hidden = false;
    } else {
      finishGame();
    }
    setGlobeInteractive(true);
  }

  function finishGame() {
    if (state.mode === 'daily') { finishDaily(); return; }
    var total = totalScore();
    var tier = total >= 3500 ? 'good' : (total >= 1500 ? 'warn' : 'bad');
    var line = total >= 4500 ? 'World-class darts.'
             : total >= 3500 ? 'Impressive geography!'
             : total >= 2500 ? 'Solid arm.'
             : total >= 1500 ? 'The Earth is big, eh?'
             : 'The ocean thanks you for the darts.';
    $('verdict').textContent = 'Final: ' + total + ' / 5000 — ' + line;
    $('verdict').className = 'tn-verdict ' + tier;
    $('tn-again-btn').hidden = false;
  }

  // ── Daily finish: shared results card + leaderboard submit ────────────────────
  function finishDaily() {
    var km = totalKm();
    var archiving = !!(window.ArcadeArchive && window.ArcadeArchive.isArchiving());
    var scored = state.scored && !archiving;
    var dayKey = window.ArcadeDailySeed.dailyDateKey();
    var doneKey = 'tn.daily.done|' + dayKey;

    // Record local history once per day (drives the "You" tab, streaks, and the
    // archive's ✓ done-mark). Only for a live, scored first play.
    if (scored && LB && LB.recordHistory && !lsGet(doneKey)) {
      LB.recordHistory(LB_GAME, { date: dayKey, difficulty: 'daily', value: km, km: km });
      if (LB.reportStats) LB.reportStats(LB_GAME);
    }

    // Hide the in-round panels; the shared card takes over.
    $('target-card').hidden = true;
    $('result').hidden = true;
    showPhase('final');

    var mount = $('results');
    var subHtml = archiving
      ? 'Practice replay — past dailies aren\'t scored.'
      : scored
        ? 'Total distance from the target across five places — lower is better.'
        : 'Daily needs your location to rank — you played unscored.';

    if (window.ArcadeResults && window.ArcadeResults.renderResults) {
      window.ArcadeResults.renderResults({
        mount: mount,
        headline: 'Daily complete!',
        statHtml: fmtKm(km) + '<small> km total from target</small>',
        subHtml: subHtml,
        dailyComplete: scored,
        gameSlug: LB_GAME,
        shareLabel: 'Share',
        onShare: function () { shareDaily(km); },
        nextLabel: archiving ? "Back to today's daily" : 'Free play',
        onNext: function () {
          if (window.ArcadeArchive && window.ArcadeArchive.isArchiving()) setMode('daily');
          else setMode('free');
        },
      });
      mount.hidden = false;
      var lbMount = mount.querySelector('#lb-inline');
      if (lbMount) {
        if (!LB || !LB.isLeaderboardConfigured || !LB.isLeaderboardConfigured()) {
          lbMount.innerHTML = '';
        } else if (archiving) {
          lbMount.innerHTML = '<div class="lb-status">Practice replay — past dailies aren\'t scored.</div>';
        } else if (!scored) {
          lbMount.innerHTML = '<div class="lb-status">Daily needs your location to rank — playing unscored.</div>';
        } else {
          lbRenderWin(lbMount, km, doneKey);
        }
      }
      try { mount.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    } else {
      // Fallback if the shared results module didn't load.
      $('verdict').textContent = 'Daily complete — ' + fmtKm(km) + ' km total from target.';
      $('verdict').className = 'tn-verdict good';
      $('result').hidden = false;
      $('tn-again-btn').hidden = false;
    }
  }

  // Submit the daily result (once per day) then render the standing. If we've
  // already submitted today, just show the board.
  function lbRenderWin(mount, km, doneKey) {
    var board = boardKeyForOffset(0);
    function showBoard(name) {
      if (lbUi) lbUi.renderBoard(mount, board, name || null);
      else mount.innerHTML = '';
    }
    function doSubmit(name) {
      mount.innerHTML = '<div class="lb-status">Submitting…</div>';
      LB.submitMetricCompletion({
        game: LB_GAME, difficulty: 'daily', value: km, handle: name,
        board: board, meta: { km: km }, alltimeVersion: 2
      }).then(function (ok) {
        if (ok) lsSet(doneKey, '1');
        showBoard(name);
      }).catch(function () { showBoard(name); });
    }
    if (lsGet(doneKey)) { showBoard(lbHandle); return; }   // already scored today
    if (lbHandle) { doSubmit(lbHandle); return; }
    // No handle yet — collect one before the first submit.
    mount.innerHTML = '<div class="lb-join"><div class="lb-join-title">🏆 Join today\'s leaderboard</div>' +
      '<div class="lb-join-row"><input id="lb-handle-input" class="lb-input" type="text" maxlength="24" placeholder="Your name" autocomplete="off" />' +
      '<button id="lb-handle-submit" class="tn-btn tn-btn-primary" type="button">Submit</button></div></div>';
    var input = mount.querySelector('#lb-handle-input');
    var btn = mount.querySelector('#lb-handle-submit');
    if (input) input.focus();
    if (btn) btn.addEventListener('click', function () {
      var name = LB.cleanHandle(input ? input.value : '');
      if (!name) { if (input) input.focus(); return; }
      lbHandle = LB.saveSharedHandle(name);
      doSubmit(name);
    });
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var b = mount.querySelector('#lb-handle-submit'); if (b) b.click(); }
    });
  }

  function shareDaily(km) {
    var dateLabel = boardKeyForOffset(0).replace('|daily', '');
    var text = 'As the Crow Flies · Daily ' + dateLabel + '\n' + fmtKm(km) + ' km total from target\n' +
      'connectthethoughts.ca/true-north';
    if (navigator.share) {
      navigator.share({ title: 'As the Crow Flies', text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        var b = document.getElementById('share-btn');
        if (b) { var o = b.textContent; b.textContent = 'Copied!'; setTimeout(function () { b.textContent = o; }, 2000); }
      }).catch(function () {});
    }
  }

  // ── Location + game start ───────────────────────────────────────────────────
  var LAST_FIX_KEY = 'tn.lastFix';
  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var fix = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          try { localStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix)); } catch (_) {}
          resolve(fix);
        },
        function (err) { reject(err); },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
      );
    });
  }
  function lastFix() {
    try {
      var raw = localStorage.getItem(LAST_FIX_KEY);
      if (!raw) return null;
      var fix = JSON.parse(raw);
      return (typeof fix.lat === 'number' && typeof fix.lon === 'number') ? fix : null;
    } catch (_) { return null; }
  }

  function geoErrorText(err) {
    // Name the actual problem — a generic message reads as "broken".
    if (err && err.code === 1) {
      return 'Location is blocked for this site. Allow it (iPhone: Settings → Privacy → Location Services → Safari Websites) and tap Start again.';
    }
    if (err && err.code === 3) {
      return 'Couldn’t get a location fix in time — try again near a window or outside.';
    }
    return 'Couldn’t determine your location (' + ((err && err.message) || 'unavailable') + '). Tap Start to retry.';
  }

  function beginGame(origin, note, originIsReal) {
    var archiving = !!(window.ArcadeArchive && window.ArcadeArchive.isArchiving());
    state = {
      phase: 'aim',
      mode: gameMode,
      origin: origin,
      // Daily scores only on a live (non-archive) daily played from a REAL
      // geolocation fix — otherwise the shared board wouldn't be fair.
      scored: gameMode === 'daily' && !!originIsReal && !archiving,
      targets: gameMode === 'daily' ? pickDailyTargets() : pickTargets(origin),
      idx: 0,
      scores: [],
      gapErrors: [],
      needleAngle: 0,
      headingAtLock: 0,
      distKm: Math.round(sliderToKm(Number($('distance-slider').value)) / 25) * 25,
      landing: null, gapKm: 0, points: 0
    };
    var res = $('results'); if (res) { res.hidden = true; res.innerHTML = ''; }
    $('start-btn').hidden = true;
    $('start-btn').disabled = false;
    showRound();
    if (note) $('mode-note').textContent = note;
  }

  function startGame() {
    $('start-btn').disabled = true;
    $('mode-note').textContent = 'Requesting compass access…';
    // iOS shows one permission dialog at a time and the motion prompt MUST
    // ride the tap — so sequence: compass permission first (await it), then
    // the location prompt. Firing both at once left geolocation hanging
    // behind the motion dialog until its timeout, which looked frozen.
    startSensors().then(function () {
      $('mode-note').textContent = 'Finding where you are…';
      return locate();
    }).then(function (origin) {
      beginGame(origin, null, true); // real fix → daily is scored
    }).catch(function (err) {
      var cached = lastFix();
      if (cached) {
        // A cached fix is still the player's real location → daily stays scored.
        beginGame(cached, 'Using your last known location — allow location access for a fresh fix.', true);
        return;
      }
      // No location at all. Daily still lets you PLAY (unscored — the shared board
      // needs a real origin to rank fairly). Free-play genuinely needs an origin,
      // so it keeps the retry prompt.
      if (gameMode === 'daily') {
        beginGame(FALLBACK_ORIGIN, 'Daily needs your location to rank — playing unscored.', false);
        return;
      }
      $('start-btn').disabled = false;
      $('start-btn').textContent = 'Try again';
      $('mode-note').textContent = geoErrorText(err);
    });
  }

  // Neutral origin for unscored daily play when no location is available.
  var FALLBACK_ORIGIN = { lat: 0, lon: 0 };

  // Reset to the pre-game idle screen (no auto-start).
  function resetToIdle() {
    state = null;
    if (globe) { globe.stop(); }
    setGlobeInteractive(false);
    var res = $('results'); if (res) { res.hidden = true; res.innerHTML = ''; }
    $('start-btn').hidden = false;
    $('start-btn').disabled = false;
    $('start-btn').textContent = 'Start';
    $('round-num').textContent = '–';
    $('score-label').innerHTML = statusLabelHtml(gameMode, '–');
    $('target-name').textContent = '…';
    $('target-card').hidden = false;
    $('result').hidden = true;
    $('tn-next-btn').hidden = true;
    $('tn-again-btn').hidden = true;
    $('mode-note').textContent = '';
    showPhase('idle');
  }

  // Switch Daily / Free-play. Always leaves any archive replay and returns to
  // idle so the next Start serves the chosen mode.
  function setMode(mode) {
    if (window.ArcadeArchive) window.ArcadeArchive.exitArchive();
    gameMode = mode;
    var md = $('mode-daily'), mr = $('mode-free');
    if (md) md.classList.toggle('active', mode === 'daily');
    if (mr) mr.classList.toggle('active', mode === 'free');
    resetToIdle();
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  function buildTicks() {
    // Uniform anonymous ticks — nothing may hint at a cardinal direction.
    var g = $('ticks'), html = '';
    for (var d = 0; d < 360; d += 15) {
      var a = d * R;
      var x1 = 120 + Math.sin(a) * 104, y1 = 120 - Math.cos(a) * 104;
      var x2 = 120 + Math.sin(a) * 96, y2 = 120 - Math.cos(a) * 96;
      html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
              '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    g.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    compassEl = $('compass');
    needleYou = $('needle-you');
    ticksEl = $('ticks');
    buildTicks();
    installAimHandlers();
    globe = ArcadeGlobe.create($('globe'));

    // ?heading=NN fakes a device heading so the orientation math is testable
    // in a desktop browser (which has no compass).
    var fake = new URLSearchParams(location.search).get('heading');
    if (fake != null && !isNaN(parseFloat(fake))) {
      sensor.fake = ((parseFloat(fake) % 360) + 360) % 360;
    }

    // ── Shared leaderboard modal (single daily board, distance metric) ─────────
    if (LB && window.ArcadeLeaderboardUI && LB.isLeaderboardConfigured && LB.isLeaderboardConfigured()) {
      lbUi = window.ArcadeLeaderboardUI.createLeaderboardModal({
        gameSlug: LB_GAME,
        getHandle: function () { return lbHandle; },
        boardKeyForOffset: function (offset) { return boardKeyForOffset(offset); },
        baseDateKey: function () { return window.ArcadeDailySeed.dailyDateKey(); },
        alltimeKey: 'daily',
        // v2: metric switched from bearing-error degrees to distance in km, so the
        // all-time board must not mix the two scales.
        alltimeVersion: 2,
        // Lower distance wins, so a candidate is better when its value is smaller.
        bestComparator: function (e, cur) { return lbVal(e) < lbVal(cur); },
        youStats: { metricLabel: 'Distance from target', buckets: [
          { label: 'Under 5,000 km', max: 5000 },
          { label: '5,000–14,999 km', max: 14999 },
          { label: '15,000–29,999 km', max: 29999 },
          { label: '30,000 km+' },
        ] },
        rowStat: function (r) { var km = lbRowKm(r); return km == null ? Math.round(Number(r.score)) + '°' : lbCell(km); },
        youRow: function (best) { return lbCell(lbBestKm(best)); },
      });
      lbUi.wire();
    } else {
      var lb = $('lbButton'); if (lb) lb.hidden = true;
    }

    // ── Past dailies (archive) — replay a prior day's seeded targets (practice) ──
    if (window.ArcadeArchive) {
      var archive = window.ArcadeArchive.createArchive({
        isDayDone: function (key) {
          return !!(LB && LB.loadHistory && LB.loadHistory(LB_GAME).some(function (h) { return h.date === key; }));
        },
        loadDailyForDate: function (key) {
          window.ArcadeArchive.enterArchiveDate(key); // seeds pickDailyTargets + board keys for that day
          gameMode = 'daily';
          var md = $('mode-daily'), mr = $('mode-free');
          if (md) md.classList.add('active');
          if (mr) mr.classList.remove('active');
          resetToIdle();
          startGame(); // re-locate (origin) and play the archived day's five places
        },
      });
      archive.wire();
    }

    // ── Daily / Free-play toggle ───────────────────────────────────────────────
    $('mode-daily') && $('mode-daily').addEventListener('click', function () { setMode('daily'); });
    $('mode-free') && $('mode-free').addEventListener('click', function () { setMode('free'); });

    $('start-btn').addEventListener('click', startGame);
    $('lock-btn').addEventListener('click', lockDirection);
    $('throw-btn').addEventListener('click', throwDart);
    $('globe').addEventListener('click', function () { globe.skip(); });
    $('distance-slider').addEventListener('input', onSlider);
    holdRepeat($('aim-minus'), nudgeAim(-1));
    holdRepeat($('aim-plus'), nudgeAim(1));
    holdRepeat($('dist-minus'), nudgeDist(-1));
    holdRepeat($('dist-plus'), nudgeDist(1));

    $('tn-next-btn').addEventListener('click', function () {
      state.idx++;
      state.phase = 'aim';
      globe.stop();
      showRound();
    });
    $('tn-again-btn').addEventListener('click', function () {
      resetToIdle();
      startGame();
    });

    // Help modal (canonical chrome pair; arcade-theme.js binds Escape)
    var help = $('help-modal');
    $('helpButton') && $('helpButton').addEventListener('click', function () { help.hidden = false; });
    $('help-close').addEventListener('click', function () { help.hidden = true; });
    help.addEventListener('click', function (e) { if (e.target === help) help.hidden = true; });

    // First-play tutorial — shared carousel; fires once, re-openable from the rules modal.
    if (window.ArcadeTutorial) {
      var TUTORIAL_STEPS = [
        {
          title: 'Aim by feel',
          body: 'A real place is named. On a phone, hold it flat — the needle stays pointing up, so <b>turn yourself and the phone</b> until it points the way you think the place lies. The compass is read secretly; north is never shown. (No compass? Drag the needle instead — the top of the screen counts as north.)',
        },
        {
          title: 'Guess the distance',
          body: 'Lock your direction, then <b>set how far away it is</b> — up to 20,000 km, the far side of the world — and throw.',
        },
        {
          title: 'Watch the dart land',
          body: 'The globe reveals your throw. The daily ranks you by <b>total distance from the target</b> — how many km your darts landed from the mark across five places — so lower is better. (Free play keeps a classic 0–5000 points score.)',
        },
        {
          title: 'Straight over a round Earth',
          body: 'Your dart flies <b>dead straight</b> — but the Earth curves under it, so the shortest path (a "great circle") looks bent on a flat map. Due east from mid-latitudes bends toward the equator on paper, yet it never turns. And every direction from your spot meets again at your <b>antipode, 20,000 km away</b> — so 0 km and 20,000 km are the only distances every heading shares.',
        },
      ];
      var tutorial = window.ArcadeTutorial.createTutorial({ gameSlug: 'true-north', steps: TUTORIAL_STEPS });
      tutorial.wire();
      tutorial.maybeAutoStart();
    }

    showPhase('idle');
  });
})();
