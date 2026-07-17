// True North — lay your phone flat, spin the needle toward a real place,
// pick a distance, and throw a dart around the globe.
//
// The device compass is read silently: north is NEVER shown before the lock.
// The needle angle is screen-relative; the real-world guess bearing is
// (device heading + needle angle). The phone must not move — heading is
// frozen the moment the player locks their direction.
//
// No compass (desktop, or permission denied): heading = 0, i.e. the top of
// the screen counts as north. Same game, minus the physical twist.
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
  ];

  var ROUNDS = 5;
  var MIN_KM = 100; // bearings to very nearby targets are unstable — skip them
  var MAX_KM = 40000;

  // ── Geometry ────────────────────────────────────────────────────────────────
  var R = Math.PI / 180;
  function bearingTo(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * R, f2 = lat2 * R, dl = (lon2 - lon1) * R;
    var y = Math.sin(dl) * Math.cos(f2);
    var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return ((Math.atan2(y, x) / R) + 360) % 360;
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * R, f2 = lat2 * R;
    var df = (lat2 - lat1) * R, dl = (lon2 - lon1) * R;
    var a = Math.sin(df / 2) * Math.sin(df / 2) +
            Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmtKm(km) { return Math.round(km).toLocaleString(); }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  var compassEl, needleYou, globe;

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

  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      pushHeading(e.webkitCompassHeading); // iOS
    } else if (e.alpha != null && (e.absolute || sensor.hasCompass)) {
      var screenA = (screen.orientation && screen.orientation.angle) || 0;
      pushHeading((360 - e.alpha + screenA) % 360); // Android
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
      return distanceKm(origin.lat, origin.lon, p[1], p[2]) >= MIN_KM;
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

  // Smallest absolute angular difference between two bearings (0-180°).
  function bearingGap(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
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

  // The ranked metric is TOTAL BEARING ERROR in whole degrees (lower is better).
  function totalDegrees() {
    return state ? state.bearingErrors.reduce(function (s, x) { return s + x; }, 0) : 0;
  }
  // Map a board row / history entry onto its degrees value (for compare + display).
  function lbVal(e) {
    if (!e) return Infinity;
    if (e.value != null) return e.value;
    if (e.degrees != null) return e.degrees;
    return Infinity;
  }
  function lbRowDegrees(r) {
    var m = r.meta || {};
    if (m.degrees != null) return Math.round(m.degrees);
    return Math.round(Number(r.score));
  }
  function lbBestDegrees(best) {
    return Math.round(best.degrees != null ? best.degrees : (best.value != null ? best.value : 0));
  }
  function lbCell(deg) { return deg + '°'; }

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
  function refreshStatus() {
    $('round-num').textContent = state ? String(state.idx + 1) : '–';
    $('score-total').textContent = state ? String(totalScore()) : '–';
  }

  function showRound() {
    var t = state.targets[state.idx];
    // Round 1 has no prior aim, so start at a random angle (no anchor hint).
    // Later rounds keep the last round's needle so players build off it — the
    // angle is screen-relative and the flat phone's heading is unchanged, so
    // the same screen angle still points the same real-world direction.
    if (state.idx === 0) state.needleAngle = Math.floor(Math.random() * 360);
    setNeedle(state.needleAngle);
    $('target-kicker').textContent = 'Which way to…';
    $('target-name').textContent = t[3] + ' ' + t[0];
    $('target-sub').textContent = 'Spin the needle, then lock it in';
    $('tn-next-btn').hidden = true;
    $('tn-again-btn').hidden = true;
    $('mode-note').textContent = sensor.hasCompass || sensor.fake != null
      ? 'Keep your phone flat and still.'
      : 'No compass — the top of the screen counts as north.';
    refreshStatus();
    showPhase('aim');
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
    var dragging = false;
    compassEl.addEventListener('pointerdown', function (ev) {
      if (!state || state.phase !== 'aim') return;
      ev.preventDefault();
      try { compassEl.setPointerCapture(ev.pointerId); } catch (_) { /* stale pointer */ }
      dragging = true;
      compassEl.classList.add('is-aiming');
      state.needleAngle = dialAngleFromEvent(ev);
      setNeedle(state.needleAngle);
    });
    compassEl.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
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
      if (!state || state.phase !== 'aim') return;
      state.needleAngle = (state.needleAngle + dir * mult + 360) % 360;
      setNeedle(state.needleAngle);
    };
  }

  function lockDirection() {
    if (!state || state.phase !== 'aim') return;
    state.headingAtLock = currentHeading(); // frozen: the phone isn't moving
    state.bearing = (state.headingAtLock + state.needleAngle) % 360;
    state.phase = 'distance';
    $('target-kicker').textContent = 'How far to…';
    $('target-sub').textContent = 'Set the distance, then throw';
    showPhase('distance');
    refreshDistance();
  }

  // ── DISTANCE: warped slider (more travel for nearer distances) ─────────────
  // Slider 0-1000 → km, piecewise-linear:
  //   0-333  → 0-2,000 km      (~6 km per step: city-scale precision)
  //   333-667 → 2,000-20,000   (~54 km per step)
  //   667-1000 → 20,000-40,000 (~60 km per step)
  var WARP = [[0, 0], [333, 2000], [667, 20000], [1000, 40000]];
  function sliderToKm(v) {
    for (var i = 1; i < WARP.length; i++) {
      if (v <= WARP[i][0]) {
        var a = WARP[i - 1], b = WARP[i];
        return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]);
      }
    }
    return MAX_KM;
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
    var t = state.targets[state.idx];
    state.landing = TNGlobe.destination(state.origin.lat, state.origin.lon, state.bearing, state.distKm);
    state.gapKm = distanceKm(state.landing.lat, state.landing.lon, t[1], t[2]);
    state.points = scoreFor(state.gapKm);
    // Ranked metric: how far off the aim was, in whole degrees, vs the true bearing.
    var trueBearing = bearingTo(state.origin.lat, state.origin.lon, t[1], t[2]);
    state.bearingGapDeg = Math.round(bearingGap(state.bearing, trueBearing));
    state.phase = 'reveal';
    $('target-kicker').textContent = 'The throw…';
    $('target-sub').textContent = '';
    showPhase('reveal');

    globe.playReveal({
      origin: state.origin,
      heading: state.headingAtLock,
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
    state.bearingErrors.push(state.bearingGapDeg);
    var t = state.targets[state.idx];
    var tier = tierFor(state.points);

    $('verdict').textContent = verdictText(state.points) + ' +' + state.points +
      (state.points === 1 ? ' point' : ' points');
    $('verdict').className = 'tn-verdict ' + tier;
    $('result-detail').textContent =
      'Your dart landed ' + fmtKm(state.gapKm) + ' km from ' + t[0] + '. ' +
      'Your aim was ' + state.bearingGapDeg + '° off. ' +
      '(True answer: ' + fmtKm(distanceKm(state.origin.lat, state.origin.lon, t[1], t[2])) + ' km away.)';
    refreshStatus();
    showPhase('score');

    if (state.idx + 1 < ROUNDS) {
      $('tn-next-btn').hidden = false;
    } else {
      finishGame();
    }
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
    var deg = totalDegrees();
    var archiving = !!(window.ArcadeArchive && window.ArcadeArchive.isArchiving());
    var scored = state.scored && !archiving;
    var dayKey = window.ArcadeDailySeed.dailyDateKey();
    var doneKey = 'tn.daily.done|' + dayKey;

    // Record local history once per day (drives the "You" tab, streaks, and the
    // archive's ✓ done-mark). Only for a live, scored first play.
    if (scored && LB && LB.recordHistory && !lsGet(doneKey)) {
      LB.recordHistory(LB_GAME, { date: dayKey, difficulty: 'daily', value: deg, degrees: deg });
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
        ? 'Total bearing error across five places — lower is better.'
        : 'Daily needs your location to rank — you played unscored.';

    if (window.ArcadeResults && window.ArcadeResults.renderResults) {
      window.ArcadeResults.renderResults({
        mount: mount,
        headline: 'Daily complete!',
        statHtml: deg + '<small>° total bearing error</small>',
        subHtml: subHtml,
        dailyComplete: scored,
        gameSlug: LB_GAME,
        shareLabel: 'Share',
        onShare: function () { shareDaily(deg); },
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
          lbRenderWin(lbMount, deg, doneKey);
        }
      }
      try { mount.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    } else {
      // Fallback if the shared results module didn't load.
      $('verdict').textContent = 'Daily complete — ' + deg + '° total bearing error.';
      $('verdict').className = 'tn-verdict good';
      $('result').hidden = false;
      $('tn-again-btn').hidden = false;
    }
  }

  // Submit the daily result (once per day) then render the standing. If we've
  // already submitted today, just show the board.
  function lbRenderWin(mount, deg, doneKey) {
    var board = boardKeyForOffset(0);
    function showBoard(name) {
      if (lbUi) lbUi.renderBoard(mount, board, name || null);
      else mount.innerHTML = '';
    }
    function doSubmit(name) {
      mount.innerHTML = '<div class="lb-status">Submitting…</div>';
      LB.submitMetricCompletion({
        game: LB_GAME, difficulty: 'daily', value: deg, handle: name,
        board: board, meta: { degrees: deg }, alltimeVersion: 1
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

  function shareDaily(deg) {
    var dateLabel = boardKeyForOffset(0).replace('|daily', '');
    var text = 'True North · Daily ' + dateLabel + '\n' + deg + '° total bearing error\n' +
      'connectthethoughts.ca/true-north';
    if (navigator.share) {
      navigator.share({ title: 'True North', text: text }).catch(function () {});
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
      bearingErrors: [],
      needleAngle: 0,
      headingAtLock: 0,
      distKm: sliderToKm(Number($('distance-slider').value)),
      landing: null, gapKm: 0, points: 0, bearingGapDeg: 0
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
    if (globe) globe.stop();
    var res = $('results'); if (res) { res.hidden = true; res.innerHTML = ''; }
    $('start-btn').hidden = false;
    $('start-btn').disabled = false;
    $('start-btn').textContent = 'Start';
    $('round-num').textContent = '–';
    $('score-total').textContent = '–';
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
    buildTicks();
    installAimHandlers();
    globe = TNGlobe.create($('globe'));

    // ?heading=NN fakes a device heading so the orientation math is testable
    // in a desktop browser (which has no compass).
    var fake = new URLSearchParams(location.search).get('heading');
    if (fake != null && !isNaN(parseFloat(fake))) {
      sensor.fake = ((parseFloat(fake) % 360) + 360) % 360;
    }

    // ── Shared leaderboard modal (single daily board, bearing-error metric) ────
    if (LB && window.ArcadeLeaderboardUI && LB.isLeaderboardConfigured && LB.isLeaderboardConfigured()) {
      lbUi = window.ArcadeLeaderboardUI.createLeaderboardModal({
        gameSlug: LB_GAME,
        getHandle: function () { return lbHandle; },
        boardKeyForOffset: function (offset) { return boardKeyForOffset(offset); },
        baseDateKey: function () { return window.ArcadeDailySeed.dailyDateKey(); },
        alltimeKey: 'daily',
        alltimeVersion: 1,
        // Lower degrees wins, so a candidate is better when its value is smaller.
        bestComparator: function (e, cur) { return lbVal(e) < lbVal(cur); },
        youStats: { metricLabel: 'Bearing error', buckets: [
          { label: 'Under 60°', max: 60 },
          { label: '60–119°', max: 119 },
          { label: '120–239°', max: 239 },
          { label: '240°+' },
        ] },
        rowStat: function (r) { return lbCell(lbRowDegrees(r)); },
        youRow: function (best) { return lbCell(lbBestDegrees(best)); },
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
          body: 'A real place is named. <b>Drag the needle</b> to point the direction you think it lies — your phone secretly reads the compass, but north is never shown.',
        },
        {
          title: 'Guess the distance',
          body: 'Lock your direction, then <b>set how far away it is</b> — up to 40,000 km, all the way around the world — and throw.',
        },
        {
          title: 'Watch the dart land',
          body: 'The globe reveals your throw. The closer your dart lands to the real spot, the more points you score — up to 1000 per round, five rounds a game.',
        },
      ];
      var tutorial = window.ArcadeTutorial.createTutorial({ gameSlug: 'true-north', steps: TUTORIAL_STEPS });
      tutorial.wire();
      tutorial.maybeAutoStart();
    }

    showPhase('idle');
  });
})();
