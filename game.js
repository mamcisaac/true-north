// True North — hold your finger on the compass, physically point the top of
// your phone at a real place, release to lock. The game reveals the true
// great-circle bearing from your location and scores the angular error.
// On devices with no compass (desktop), the dial is dragged to aim instead.
(function () {
  'use strict';

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
  function angleDiff(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }
  function fmtDeg(d) { return Math.round(d) + '°'; }
  function compassPoint(deg) {
    var pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return pts[Math.round(deg / 22.5) % 16];
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  var compassEl, needleYou, needleTrue, liveEl, holdHint;

  // ── Heading source: device compass, or drag-the-dial fallback ──────────────
  var sensor = {
    mode: 'dial',        // 'ios' | 'android' | 'dial'
    heading: 0,          // latest device heading (deg from true-ish north)
    dial: 0,             // dial-mode aim angle
    listening: false,
  };

  function onOrientation(e) {
    var was = sensor.mode;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      sensor.mode = 'ios';
      sensor.heading = e.webkitCompassHeading;
    } else if (e.alpha != null && (e.absolute || sensor.mode === 'android')) {
      sensor.mode = 'android';
      var screenA = (screen.orientation && screen.orientation.angle) || 0;
      sensor.heading = (360 - e.alpha + screenA) % 360;
    }
    // First real compass reading often lands after the round is already on
    // screen — flip the dial-mode hints over to compass-mode wording.
    if (was === 'dial' && sensor.mode !== 'dial') refreshModeHints();
  }

  function refreshModeHints() {
    var dial = sensor.mode === 'dial';
    if (state && !state.locked) {
      $('target-kicker').textContent = dial ? 'Drag the needle toward…' : 'Point your phone toward…';
      holdHint.textContent = dial ? 'Drag to aim, release' : 'Hold, aim, release';
    }
    if (state) {
      $('mode-note').textContent = dial
        ? 'No compass detected — drag the dial to aim.'
        : 'Compass mode — physically point your phone.';
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
        .catch(function () { /* stays in dial mode */ });
    }
    attach();
    return Promise.resolve();
  }

  function currentAim() {
    // If real compass data has arrived, trust it; otherwise the dial.
    return (sensor.mode === 'dial') ? sensor.dial : sensor.heading;
  }

  // ── Game state ──────────────────────────────────────────────────────────────
  var state = null; // { origin:{lat,lon}, targets:[...], idx, errors:[], locked }

  function pickTargets(origin) {
    var pool = PLACES.filter(function (p) {
      return distanceKm(origin.lat, origin.lon, p[1], p[2]) >= MIN_KM;
    });
    // Fisher–Yates on a copy, take the first ROUNDS.
    var a = pool.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, ROUNDS);
  }

  function verdictFor(err) {
    if (err <= 10)  return { text: 'Bullseye!',      cls: 'good' };
    if (err <= 25)  return { text: 'Sharp.',          cls: 'good' };
    if (err <= 60)  return { text: 'Warm-ish.',       cls: 'warn' };
    if (err <= 120) return { text: 'Cold.',           cls: 'bad'  };
    return { text: 'Wrong hemisphere!', cls: 'bad' };
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  function setNeedle(el, deg) { el.style.transform = 'rotate(' + deg + 'deg)'; }

  function showRound() {
    var t = state.targets[state.idx];
    $('round-num').textContent = String(state.idx + 1);
    $('target-kicker').textContent = sensor.mode === 'dial'
      ? 'Drag the needle toward…' : 'Point your phone toward…';
    $('target-name').textContent = t[3] + ' ' + t[0];
    $('target-sub').textContent = '';
    $('result').hidden = true;
    $('next-btn').hidden = true;
    $('again-btn').hidden = true;
    needleTrue.hidden = true;
    state.locked = false;
    holdHint.textContent = sensor.mode === 'dial' ? 'Drag to aim, release' : 'Hold, aim, release';
    liveEl.innerHTML = '&nbsp;';
  }

  function lockGuess() {
    if (!state || state.locked) return;
    state.locked = true;
    var t = state.targets[state.idx];
    var guess = currentAim();
    var truth = bearingTo(state.origin.lat, state.origin.lon, t[1], t[2]);
    var err = angleDiff(guess, truth);
    state.errors.push(err);

    // In sensor mode the dial is a fixed frame (N at top); show both needles.
    setNeedle(needleYou, guess);
    setNeedle(needleTrue, truth);
    needleTrue.hidden = false;

    var v = verdictFor(err);
    $('verdict').textContent = v.text + ' ' + fmtDeg(err) + ' off';
    $('verdict').className = 'tn-verdict ' + v.cls;
    var km = Math.round(distanceKm(state.origin.lat, state.origin.lon, t[1], t[2]));
    $('result-detail').textContent =
      t[0] + ' is ' + km.toLocaleString() + ' km away, bearing ' +
      fmtDeg(truth) + ' (' + compassPoint(truth) + '). You aimed ' +
      fmtDeg(guess) + ' (' + compassPoint(guess) + ').';
    $('result').hidden = false;

    var avg = state.errors.reduce(function (s, e) { return s + e; }, 0) / state.errors.length;
    $('avg-error').textContent = fmtDeg(avg);

    if (state.idx + 1 < ROUNDS) {
      $('next-btn').hidden = false;
    } else {
      var fv = verdictFor(avg);
      $('verdict').textContent = 'Final: ' + fmtDeg(avg) + ' average — ' + fv.text;
      $('verdict').className = 'tn-verdict ' + fv.cls;
      $('again-btn').hidden = false;
    }
  }

  // ── Aiming interactions ─────────────────────────────────────────────────────
  var aimRaf = null;
  function aimLoop() {
    if (!compassEl.classList.contains('is-aiming')) return;
    var a = currentAim();
    setNeedle(needleYou, a);
    liveEl.textContent = fmtDeg(a) + ' ' + compassPoint(a);
    aimRaf = requestAnimationFrame(aimLoop);
  }

  function dialAngleFromEvent(ev) {
    var r = compassEl.getBoundingClientRect();
    var dx = ev.clientX - (r.left + r.width / 2);
    var dy = ev.clientY - (r.top + r.height / 2);
    return (Math.atan2(dx, -dy) / R + 360) % 360;
  }

  function installAimHandlers() {
    compassEl.addEventListener('pointerdown', function (ev) {
      if (!state || state.locked) return;
      ev.preventDefault();
      try { compassEl.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic/stale pointer */ }
      compassEl.classList.add('is-aiming');
      if (sensor.mode === 'dial') sensor.dial = dialAngleFromEvent(ev);
      startSensors(); // iOS permission prompt rides the first hold
      aimLoop();
    });
    compassEl.addEventListener('pointermove', function (ev) {
      if (!compassEl.classList.contains('is-aiming')) return;
      if (sensor.mode === 'dial') sensor.dial = dialAngleFromEvent(ev);
    });
    compassEl.addEventListener('pointerup', function () {
      if (!compassEl.classList.contains('is-aiming')) return;
      compassEl.classList.remove('is-aiming');
      if (aimRaf) cancelAnimationFrame(aimRaf);
      lockGuess();
    });
    // A cancelled pointer (system dialog, gesture interruption) aborts the
    // aim WITHOUT locking — the player never chose to release.
    compassEl.addEventListener('pointercancel', function () {
      if (!compassEl.classList.contains('is-aiming')) return;
      compassEl.classList.remove('is-aiming');
      if (aimRaf) cancelAnimationFrame(aimRaf);
      liveEl.innerHTML = '&nbsp;';
    });
  }

  // ── Location + game start ───────────────────────────────────────────────────
  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
        function (err) { reject(err); },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
      );
    });
  }

  function startGame() {
    $('start-btn').disabled = true;
    $('mode-note').textContent = 'Finding where you are…';
    startSensors(); // ride the Start tap for the iOS sensor prompt too
    locate().then(function (origin) {
      state = { origin: origin, targets: pickTargets(origin), idx: 0, errors: [], locked: false };
      $('start-btn').hidden = true;
      $('start-btn').disabled = false;
      $('avg-error').textContent = '–';
      $('mode-note').textContent = (sensor.mode === 'dial')
        ? 'No compass detected — drag the dial to aim.'
        : 'Compass mode — physically point your phone.';
      showRound();
    }).catch(function () {
      $('start-btn').disabled = false;
      $('mode-note').textContent =
        'True North needs your location to compute real directions — allow location access and try again.';
    });
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  function buildTicks() {
    var g = $('ticks'), html = '';
    for (var d = 0; d < 360; d += 15) {
      var main = d % 90 === 0, mid = d % 45 === 0;
      var len = main ? 14 : (mid ? 10 : 6);
      var a = d * R;
      var x1 = 120 + Math.sin(a) * 104, y1 = 120 - Math.cos(a) * 104;
      var x2 = 120 + Math.sin(a) * (104 - len), y2 = 120 - Math.cos(a) * (104 - len);
      html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
              '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    g.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    compassEl = $('compass');
    needleYou = $('needle-you');
    needleTrue = $('needle-true');
    liveEl = $('live-readout');
    holdHint = $('hold-hint');
    buildTicks();
    installAimHandlers();
    // No leaderboard (yet) — the canonical topbar ships the button visible.
    var lb = $('lbButton'); if (lb) lb.hidden = true;
    $('start-btn').addEventListener('click', startGame);
    $('next-btn').addEventListener('click', function () { state.idx++; showRound(); });
    $('again-btn').addEventListener('click', function () {
      state = null;
      $('start-btn').hidden = false;
      $('round-num').textContent = '–';
      $('avg-error').textContent = '–';
      $('target-name').textContent = '…';
      $('result').hidden = true;
      $('again-btn').hidden = true;
      startGame();
    });
    // Help modal (canonical chrome pair; arcade.js binds Escape)
    var help = $('help-modal');
    $('helpButton') && $('helpButton').addEventListener('click', function () { help.hidden = false; });
    $('help-close').addEventListener('click', function () { help.hidden = true; });
    help.addEventListener('click', function (e) { if (e.target === help) help.hidden = true; });
  });
})();
