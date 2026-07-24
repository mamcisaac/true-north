// Arcade shared globe — canvas orthographic globe (no deps), vended to every
// game that draws the Earth (true-north, where-in-the-world). ONE canonical
// source: hand-rolled orthographic projection (rotate lat/lon unit vectors into
// view space, hemisphere-clip via the view-axis component), Natural Earth 110m
// land (window.WORLD_LAND) + internal country borders (window.WORLD_BORDERS),
// graticule, great-circle sampling, and an rAF+timeout reveal timeline.
//
// The projection carries a `roll` (the true bearing that points to the top of
// the screen) so a game can spin the globe to match a phone compass; roll = 0 is
// north-up, and at roll = 0 the projection has an exact closed-form inverse
// (unproject) that powers tap-to-pin and pointer drag. unproject is roll-aware
// too, so it stays correct at any roll.
//
// Public API (window.ArcadeGlobe):
//   create(canvas, {
//     interactive,   // start with drag/pinch free-look on (default false)
//     wheelZoom,     // also zoom on wheel — swallows page scroll, so opt-in
//     onPinChange,   // called with {lat,lon} when the user drops a pin. Passing
//                    // it is what makes the globe pinnable at all: a reveal-only
//                    // globe omits it, so free-look never drops a stray pin.
//   }) => {
//     // shared
//     render(), skip(), stop(), cam,
//     setInteractive(on),            // toggle free-look at runtime (e.g. after a reveal)
//     // reveals (a game calls the one it needs)
//     playGuessReveal(job),          // north-up guess→answer arc + answer pin
//     playReveal(job, cb),           // dart flight over the full great circle
//     // pin/camera extras
//     setPin(v|null), getPin(), setView({lat,lon,km}), zoomBy(factor),
//     lockPin(), unlockPin(), clearReveal(), destroy()
//   }
// setInteractive also flips an `is-interactive` class on the canvas, so a game's
// CSS owns the grab cursor.
//   distanceKm(a,b) | (lat1,lon1,lat2,lon2)
//   bearingTo(a,b)  | (lat1,lon1,lat2,lon2)
//   destination(a,bearingDeg,km) | (lat,lon,bearingDeg,km)
//   EARTH_KM (6371), HALF_LAP_KM (π·R ≈ 20,015 — the antipodal ceiling)
// The three statics accept either two {lat,lon} objects (where-in-the-world's
// convention) or raw scalars (true-north's) — first arg decides. gap/geo math
// uses the haversine radius R = EARTH_KM.
//
// A consuming game must NOT re-implement any of this (no local haversine, no
// local 6371 / π·R). Import it from here — that duplication is the whole reason
// this module exists.
(function () {
  'use strict';

  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;
  var EARTH_KM = 6371;
  // The antipodal distance (π·R) — the farthest two points on Earth can be.
  // Throw past it and you're just coming back round the other side, so it's the
  // real ceiling for any distance a game lets a player pick or score.
  var HALF_LAP_KM = Math.PI * EARTH_KM; // ≈ 20,015 km

  // ── Geodesy (self-contained; scalar args) ─────────────────────────────────
  function bearingTo(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * D2R, f2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    var y = Math.sin(dl) * Math.cos(f2);
    var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return ((Math.atan2(y, x) * R2D) + 360) % 360;
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * D2R, f2 = lat2 * D2R;
    var df = (lat2 - lat1) * D2R, dl = (lon2 - lon1) * D2R;
    var a = Math.sin(df / 2) * Math.sin(df / 2) +
            Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  // Forward geodesic: start + true bearing + distance → end point. The dart path
  // is THIS evaluated at partial distances — never a slerp between endpoints,
  // which would fly the short way for throws past the antipode (>20,015 km).
  function destination(lat, lon, bearingDeg, distKm) {
    var d = distKm / EARTH_KM, th = bearingDeg * D2R;
    var f1 = lat * D2R, l1 = lon * D2R;
    var sf1 = Math.sin(f1), cf1 = Math.cos(f1);
    var sd = Math.sin(d), cd = Math.cos(d);
    var f2 = Math.asin(sf1 * cd + cf1 * sd * Math.cos(th));
    var l2 = l1 + Math.atan2(Math.sin(th) * sd * cf1, cd - sf1 * Math.sin(f2));
    var lon2 = ((l2 * R2D) + 540) % 360 - 180; // normalize to (-180, 180]
    return { lat: f2 * R2D, lon: lon2 };
  }

  // ── Projection math (pure, module-scope so it's unit-testable) ────────────
  // The two view rotations (about the north axis by lon0, then about the new
  // east axis by lat0) are pure rotations, so invViewVec inverts them exactly.
  function latLonToVec(lat, lon) {
    var f = lat * D2R, l = lon * D2R, cf = Math.cos(f);
    return [cf * Math.cos(l), cf * Math.sin(l), Math.sin(f)];
  }
  function vecToLatLon(x, y, z) {
    return {
      lat: Math.asin(Math.max(-1, Math.min(1, z))) * R2D,
      lon: Math.atan2(y, x) * R2D
    };
  }
  function makeRot(lat0, lon0) {
    var l0 = lon0 * D2R, f0 = lat0 * D2R;
    return { cl0: Math.cos(l0), sl0: Math.sin(l0), cf0: Math.cos(f0), sf0: Math.sin(f0) };
  }
  // → [x2 (toward viewer), y1 (east/screen-x), z2 (north/screen-y)].
  function viewVec(R, x, y, z) {
    var x1 = x * R.cl0 + y * R.sl0;
    var y1 = -x * R.sl0 + y * R.cl0;
    var x2 = x1 * R.cf0 + z * R.sf0;
    var z2 = -x1 * R.sf0 + z * R.cf0;
    return [x2, y1, z2];
  }
  // Exact inverse of viewVec (transpose of the two rotations).
  function invViewVec(R, x2, y1, z2) {
    var x1 = x2 * R.cf0 - z2 * R.sf0;
    var z1 = x2 * R.sf0 + z2 * R.cf0;
    var x = x1 * R.cl0 - y1 * R.sl0;
    var y = x1 * R.sl0 + y1 * R.cl0;
    return [x, y, z1];
  }
  // lat/lon → {x, y, visible} in canvas px, rolling the screen so bearing
  // `rollDeg` points up (rollDeg = 0 → north-up, no screen rotation).
  function project(R, scale, cx, cy, rollDeg, lat, lon) {
    var v = latLonToVec(lat, lon);
    var w = viewVec(R, v[0], v[1], v[2]);
    var rr = rollDeg * D2R, cr = Math.cos(rr), sr = Math.sin(rr);
    var xs = w[1] * scale, ys = -w[2] * scale;
    return { x: cx + xs * cr + ys * sr, y: cy + ys * cr - xs * sr, visible: w[0] > 0 };
  }
  // canvas px → {lat, lon} on the visible hemisphere, or null if off-disc.
  // Inverts the roll first, then the orthographic projection.
  function unproject(R, scale, cx, cy, rollDeg, px, py) {
    var rr = rollDeg * D2R, cr = Math.cos(rr), sr = Math.sin(rr);
    var dx = px - cx, dy = py - cy;
    var xs = dx * cr - dy * sr, ys = dx * sr + dy * cr; // undo the screen roll
    var y1 = xs / scale, z2 = -ys / scale;
    var s = 1 - y1 * y1 - z2 * z2;
    if (s < 0) return null;            // outside the globe disc
    var x2 = Math.sqrt(s);             // + root = front hemisphere
    var v = invViewVec(R, x2, y1, z2);
    return vecToLatLon(v[0], v[1], v[2]);
  }

  // ── Small helpers ─────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angleLerp(a, b, t) { var d = ((b - a + 540) % 360) - 180; return a + d * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Great-circle sampling. sampleGeodesic walks a bearing from an origin;
  // sampleBetween walks a→b along their shared great circle.
  function sampleGeodesic(origin, bearing, fromKm, toKm) {
    var pts = [], stepKm = 120; // ~1° — smooth at any zoom we use
    var n = Math.max(2, Math.ceil((toKm - fromKm) / stepKm));
    for (var i = 0; i <= n; i++) {
      pts.push(destination(origin.lat, origin.lon, bearing, fromKm + (toKm - fromKm) * i / n));
    }
    return pts;
  }
  function sampleBetween(a, b) {
    var d = distanceKm(a.lat, a.lon, b.lat, b.lon);
    if (d < 1) return [{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }];
    return sampleGeodesic(a, bearingTo(a.lat, a.lon, b.lat, b.lon), 0, d);
  }

  function create(canvas, opts) {
    opts = opts || {};
    var onPinChange = opts.onPinChange;
    // Tap-to-pin only makes sense for a game that wants a pin — inferred from
    // onPinChange, so a reveal-only globe can turn on free-look without a stray
    // tap dropping a pin it has no concept of.
    var pinnable = !!onPinChange;
    // Wheel zoom swallows page scroll over the canvas, so it is opt-in.
    var wheelZoom = !!opts.wheelZoom;
    var interactive = false; // runtime flag — set via setInteractive() below
    var ctx = canvas.getContext('2d');
    var size = 0, cx = 0, cy = 0, dpr = 1;

    // Pre-vectorized land: per ring, a Float64Array of unit-vector triples.
    var land = [];
    (window.WORLD_LAND || []).forEach(function (ring) {
      var n = ring.length / 2, v = new Float64Array(n * 3);
      for (var i = 0; i < n; i++) {
        var lon = ring[i * 2] * D2R, lat = ring[i * 2 + 1] * D2R, cl = Math.cos(lat);
        v[i * 3] = cl * Math.cos(lon);
        v[i * 3 + 1] = cl * Math.sin(lon);
        v[i * 3 + 2] = Math.sin(lat);
      }
      land.push(v);
    });

    // Internal country borders: same pre-vectorization as land, but drawn as
    // open stroked polylines (not filled rings) on top of the land fill.
    var borders = [];
    (window.WORLD_BORDERS || []).forEach(function (line) {
      var n = line.length / 2, v = new Float64Array(n * 3);
      for (var i = 0; i < n; i++) {
        var lon = line[i * 2] * D2R, lat = line[i * 2 + 1] * D2R, cl = Math.cos(lat);
        v[i * 3] = cl * Math.cos(lon);
        v[i * 3 + 1] = cl * Math.sin(lon);
        v[i * 3 + 2] = Math.sin(lat);
      }
      borders.push(v);
    });

    // Camera: {lat0, lon0, roll, scale}. scale = globe radius in canvas px.
    // roll = the true bearing that points to the top of the screen (0 = north-up).
    // HOME_VIEW is the view an interactive round opens on; clearReveal() returns
    // here, so it stays the single source of truth for first paint and reset.
    // (Reveal-only globes never show HOME_VIEW — playReveal sets scale before the
    // stage is unhidden — so this default is harmless there.)
    var HOME_VIEW = { lat0: 20, lon0: 0, km: 18000 };
    var cam = { lat0: HOME_VIEW.lat0, lon0: HOME_VIEW.lon0, roll: 0, scale: 0 };
    var pin = null;              // user-dropped {lat,lon} | null
    var scene = null;            // reveal state | null
    var pinLocked = false;       // tap-to-pin disabled (once reveal starts)
    var revealActive = false;    // animation running → taps skip, no drag

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || 320;
      var target = Math.round(w * dpr) || 300;
      if (canvas.width !== target) {
        var old = size;
        canvas.width = canvas.height = target;
        if (old && cam.scale) cam.scale *= target / old; // preserve zoom on resize
      }
      size = canvas.width; cx = cy = size / 2;
      if (!cam.scale) cam.scale = scaleForKm(HOME_VIEW.km);
    }

    // scale so the canvas width spans roughly `km` of ground at the center.
    function scaleForKm(km) {
      var half = Math.min(km / 2 / EARTH_KM, Math.PI / 2 - 0.01);
      return (size / 2) / Math.sin(half);
    }
    function minScale() { return scaleForKm(22000); } // most zoomed-out
    function maxScale() { return scaleForKm(600); }    // most zoomed-in
    function clampScale(s) { return clamp(s, minScale(), maxScale()); }

    // ── Drawing (all read `curR`/`curCr`/`curSr`, set once per render) ────────
    var curR = makeRot(cam.lat0, cam.lon0);
    var curCr = 1, curSr = 0; // cos/sin of the current roll
    function projectLL(lat, lon) { return project(curR, cam.scale, cx, cy, cam.roll, lat, lon); }
    function vw(x, y, z) { return viewVec(curR, x, y, z); }
    function scr(y1, z2) {
      var xs = y1 * cam.scale, ys = -z2 * cam.scale;
      return [cx + xs * curCr + ys * curSr, cy + ys * curCr - xs * curSr];
    }

    function drawLandRing(vec) {
      var n = vec.length / 3, any = false, i, v;
      for (i = 0; i < n; i++) if (vw(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2])[0] > 0) { any = true; break; }
      if (!any) return false;
      for (i = 0; i < n; i++) {
        v = vw(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2]);
        var y2 = v[1], z2 = v[2];
        if (v[0] <= 0) { var m = Math.sqrt(y2 * y2 + z2 * z2) || 1; y2 /= m; z2 /= m; } // clamp to limb
        var p = scr(y2, z2);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      return true;
    }

    // Stroke the internal country borders. Each is an open polyline, so we lift
    // the pen when a vertex crosses to the back hemisphere (unlike the land
    // rings, which fill and clamp to the limb) — a border must never draw a
    // chord straight across the disc.
    function drawBorders(colors) {
      if (!borders.length) return;
      // One batched path, fixed-width hairline. colors.country (not colors.border,
      // which is drawCaption's pill outline) keeps borders legible over the
      // 0.85-alpha land fill in both themes and distinct from the fainter
      // graticule drawn beneath the land.
      ctx.strokeStyle = colors.country;
      ctx.lineWidth = dpr;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      for (var b = 0; b < borders.length; b++) {
        var vec = borders[b], n = vec.length / 3, started = false;
        for (var i = 0; i < n; i++) {
          var v = vw(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2]);
          if (v[0] > 0) {
            var p = scr(v[1], v[2]);
            if (started) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
            started = true;
          } else started = false;
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawGraticule(colors) {
      ctx.strokeStyle = colors.graticule;
      ctx.lineWidth = dpr;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      var lat, lon, t, p, prev;
      for (lat = -60; lat <= 60; lat += 30) {
        prev = false;
        for (lon = -180; lon <= 180; lon += 3) {
          p = projectLL(lat, lon);
          if (p.visible) { if (prev) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
          prev = p.visible;
        }
      }
      for (lon = -180; lon < 180; lon += 30) {
        prev = false;
        for (t = -90; t <= 90; t += 3) {
          p = projectLL(t, lon);
          if (p.visible) { if (prev) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
          prev = p.visible;
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Polyline through lat/lon points, breaking at the limb.
    function drawGeoPath(pts) {
      var started = false;
      for (var i = 0; i < pts.length; i++) {
        var p = projectLL(pts[i].lat, pts[i].lon);
        if (p.visible) { if (started) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); started = true; }
        else started = false;
      }
    }

    function dot(lat, lon, r, color) {
      var p = projectLL(lat, lon);
      if (!p.visible) return null;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * dpr, 0, Math.PI * 2);
      ctx.fill();
      return p;
    }
    function ringAt(p, r, color, width, alpha) {
      ctx.strokeStyle = color;
      ctx.lineWidth = (width || 2) * dpr;
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function drawCaption(text, colors) {
      ctx.font = '600 ' + Math.round(14 * dpr) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var tw = ctx.measureText(text).width;
      var padX = 12 * dpr, h = 28 * dpr;
      var x = cx;
      var y = clamp(cy + Math.min(cam.scale, size / 2) * 0.78, h, size - h / 2);
      roundRect(x - tw / 2 - padX, y - h / 2, tw + padX * 2, h, h / 2);
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = colors.pill;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = dpr;
      ctx.stroke();
      ctx.fillStyle = colors.fg;
      ctx.fillText(text, x, y);
    }

    function render() {
      resize();
      curR = makeRot(cam.lat0, cam.lon0);
      var rr = cam.roll * D2R; curCr = Math.cos(rr); curSr = Math.sin(rr);
      var colors = {
        // Ocean must read as WATER against the page — key off the navy tone
        // (navy in light / blue in dark) instead of a washed cream-on-cream disc.
        ocean: cssVar('--tone-sky-fg', '#33628f'),
        land: cssVar('--border-strong', '#334155'),
        graticule: cssVar('--border', '#1e293b'),
        border: cssVar('--border', '#1e293b'),
        // Country borders: legible over the 0.85-alpha land fill in both themes
        // (light: dark olive on tan; dark: light gray on brown).
        country: cssVar('--fg-muted', '#a8a08a'),
        accent: cssVar('--accent', '#5eead4'),
        fg: cssVar('--fg', '#e2e8f0'),
        pill: cssVar('--bg-elev', '#0f172a'),
        // Dart-flight target pin (true-north): warm rose.
        target: cssVar('--tone-rose-fg', '#fb7185'),
        // Guess-reveal answer pin (where-in-the-world) must read as clearly NOT
        // the guess pin (--accent). Where accent is warm, rose collides with it,
        // so violet separates cleanly from accent and the good/warn/bad tiers.
        answer: cssVar('--tone-violet-fg', '#a794c9'),
        good: cssVar('--good', '#22c55e'),
        warn: cssVar('--warn', '#eab308'),
        bad: cssVar('--bad', '#ef4444')
      };
      var baseAlpha = (scene && scene.alpha != null) ? scene.alpha : 1;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.globalAlpha = baseAlpha;

      // Ocean disc doubles as the clip region for everything on the globe.
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cam.scale, size), 0, Math.PI * 2);
      ctx.fillStyle = colors.ocean;
      ctx.fill();
      ctx.save();
      ctx.clip();

      // Graticule sits UNDER the land fill: grid lines belong to the ocean and
      // fade out at the coasts (the 0.85-alpha land lets a ghost of them
      // through). Keeping them off the land matters in light theme, where the
      // cream graticule over tan land would out-shout the country borders —
      // the only lines land should carry.
      drawGraticule(colors);

      // Land
      ctx.beginPath();
      for (var i = 0; i < land.length; i++) drawLandRing(land[i]);
      ctx.fillStyle = colors.land;
      ctx.globalAlpha = baseAlpha * 0.85;
      ctx.fill('evenodd');
      ctx.globalAlpha = baseAlpha;

      drawBorders(colors);

      if (scene) {
        // The whole great circle a throw rides — faint, finely dashed, on the
        // surface. This is what makes "straight" read as a curve on a sphere.
        if (scene.fullCircle && scene.fullCircle.length > 1 && (scene.circleAlpha || 0) > 0) {
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.5 * dpr;
          ctx.setLineDash([3 * dpr, 6 * dpr]);
          ctx.globalAlpha = baseAlpha * 0.30 * scene.circleAlpha;
          ctx.beginPath();
          drawGeoPath(scene.fullCircle);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = baseAlpha;
        }
        // Dart trail (true-north) — the flown part, lying exactly on that circle
        if (scene.trail && scene.trail.length > 1) {
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 2.5 * dpr;
          ctx.lineCap = 'round';
          ctx.beginPath();
          drawGeoPath(scene.trail);
          ctx.stroke();
        }
        // Gap arc (dashed, tier-colored) — both reveals
        if (scene.gapArc && scene.gapArc.length > 1) {
          ctx.strokeStyle = colors[scene.tier] || colors.warn;
          ctx.lineWidth = 2.5 * dpr;
          ctx.lineCap = 'round';
          ctx.setLineDash([6 * dpr, 5 * dpr]);
          ctx.beginPath();
          drawGeoPath(scene.gapArc);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Origin (true-north)
        if (scene.origin) {
          var op = dot(scene.origin.lat, scene.origin.lon, 4, colors.accent);
          if (op && scene.pulse != null) ringAt(op, 4 + 10 * scene.pulse, colors.accent, 2, 1 - scene.pulse);
        }
        // Target pin + emoji (true-north)
        if (scene.target) {
          var tp = dot(scene.target.lat, scene.target.lon, 4.5, colors.target);
          if (tp) {
            ringAt(tp, 8 + (scene.targetPulse || 0) * 8, colors.target, 2, 1 - (scene.targetPulse || 0) * 0.8);
            if (scene.target.emoji) {
              ctx.font = (16 * dpr) + 'px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(scene.target.emoji, tp.x, tp.y - 12 * dpr);
            }
          }
        }
        // Landing marker + impact rings (true-north)
        if (scene.landing) {
          var lp = dot(scene.landing.lat, scene.landing.lon, 4, colors.fg);
          if (lp && scene.impact != null) {
            ringAt(lp, 5 + 22 * scene.impact, colors.fg, 2, 1 - scene.impact);
            ringAt(lp, 5 + 12 * scene.impact, colors.fg, 2, 1 - scene.impact);
          }
        }
        // Dart: a small triangle at the tip of the trail, along its course
        if (scene.dart) {
          var dp = projectLL(scene.dart.lat, scene.dart.lon);
          if (dp.visible) {
            var az = ((scene.dart.course - cam.roll) % 360) * D2R; // screen azimuth
            ctx.save();
            ctx.translate(dp.x, dp.y);
            ctx.rotate(az);
            ctx.fillStyle = colors.accent;
            ctx.beginPath();
            ctx.moveTo(0, -9 * dpr);
            ctx.lineTo(5.5 * dpr, 6 * dpr);
            ctx.lineTo(0, 2.5 * dpr);
            ctx.lineTo(-5.5 * dpr, 6 * dpr);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
        // Guess pin (where-in-the-world)
        if (scene.guess) dot(scene.guess.lat, scene.guess.lon, 5, colors.accent);
        // Answer pin (where-in-the-world)
        if (scene.showAnswer && scene.answer) {
          var ap = dot(scene.answer.lat, scene.answer.lon, 5.5, colors.answer);
          if (ap) ringAt(ap, 8 + (scene.answerPulse || 0) * 10, colors.answer, 2, 1 - (scene.answerPulse || 0) * 0.8);
        }
      }

      // User pin — glued to its lat/lon (hidden on the back hemisphere by dot()).
      if (pin) {
        var pp = dot(pin.lat, pin.lon, 5, colors.accent);
        if (pp) ringAt(pp, 11, colors.accent, 2, 0.5);
      }

      ctx.restore(); // un-clip

      // Limb outline
      ctx.strokeStyle = colors.graticule;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cam.scale, size * 2), 0, Math.PI * 2);
      ctx.stroke();

      // Caption pill (canvas-drawn; guess reveal uses it — dart reveal captions
      // to an external DOM node via cb.caption and leaves scene.caption unset).
      if (scene && scene.caption) drawCaption(scene.caption, colors);

      ctx.restore();
    }

    // Coalesce input-driven renders into one frame; no continuous loop.
    // rAF for smoothness, with a timeout backstop so a queued render still lands
    // when rAF is suspended (hidden/occluded tab) — otherwise a theme flip or
    // setPin made off-screen would never repaint.
    var pendingRAF = null, pendingTO = null;
    function scheduleRender() {
      if (pendingRAF || pendingTO) return;
      var go = function () {
        if (pendingRAF) cancelAnimationFrame(pendingRAF);
        if (pendingTO) clearTimeout(pendingTO);
        pendingRAF = null; pendingTO = null;
        render();
      };
      pendingRAF = requestAnimationFrame(go);
      pendingTO = setTimeout(go, 120);
    }

    // ── Pointer interaction (bound only when interactive) ─────────────────────
    var pointers = new Map();      // pointerId → {x,y} in client px
    var tap = null;                // primary-pointer tap tracker
    var pinchPrev = 0, pinchMid = null;

    function clientToCanvas(clx, cly) {
      var r = canvas.getBoundingClientRect();
      return { x: (clx - r.left) * (canvas.width / (r.width || 1)),
               y: (cly - r.top) * (canvas.height / (r.height || 1)) };
    }
    function pxRatio() {
      var r = canvas.getBoundingClientRect();
      return canvas.width / (r.width || 1);
    }
    function pointerDistance() {
      var a = null, b = null;
      pointers.forEach(function (p) { if (!a) a = p; else if (!b) b = p; });
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    }
    function pointerMidpoint() {
      var sx = 0, sy = 0, n = 0;
      pointers.forEach(function (p) { sx += p.x; sy += p.y; n++; });
      return n ? { x: sx / n, y: sy / n } : null;
    }
    // Rotate the globe by a client-px drag (grab-and-drag: content follows finger).
    function rotateByPixels(dxClient, dyClient) {
      var s = pxRatio();
      cam.lon0 -= (dxClient * s) / cam.scale * R2D;
      cam.lat0 = clamp(cam.lat0 + (dyClient * s) / cam.scale * R2D, -85, 85);
    }

    function onDown(e) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        tap = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t: (performance.now ? performance.now() : Date.now()), maxMove: 0 };
      } else {
        tap = null; // multi-touch is never a tap
        pinchPrev = pointerDistance();
        pinchMid = pointerMidpoint();
      }
    }
    function onMove(e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (tap && e.pointerId === tap.id) {
        tap.maxMove = Math.max(tap.maxMove, Math.hypot(e.clientX - tap.sx, e.clientY - tap.sy));
      }
      if (revealActive) return;
      if (pointers.size === 1) {
        rotateByPixels(e.clientX - prev.x, e.clientY - prev.y);
        scheduleRender();
      } else if (pointers.size >= 2) {
        var dist = pointerDistance();
        if (pinchPrev) cam.scale = clampScale(cam.scale * (dist / pinchPrev));
        pinchPrev = dist;
        var mid = pointerMidpoint();
        if (pinchMid && mid) rotateByPixels(mid.x - pinchMid.x, mid.y - pinchMid.y);
        pinchMid = mid;
        scheduleRender();
      }
    }
    function onUp(e) {
      if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      if (tap && e.pointerId === tap.id) {
        var dt = (performance.now ? performance.now() : Date.now()) - tap.t;
        var isTap = tap.maxMove < 8 && dt < 350;
        var wasTap = tap;
        tap = null;
        if (isTap) {
          if (revealActive) { skip(); }
          else if (pinnable && !pinLocked) {
            var pt = clientToCanvas(wasTap.sx, wasTap.sy);
            var ll = unproject(makeRot(cam.lat0, cam.lon0), cam.scale, cx, cy, cam.roll, pt.x, pt.y);
            if (ll) {
              pin = { lat: ll.lat, lon: ll.lon };
              scheduleRender();
              if (onPinChange) onPinChange({ lat: pin.lat, lon: pin.lon });
            }
          }
        }
      }
      if (pointers.size < 2) { pinchPrev = 0; pinchMid = null; }
    }
    function onWheel(e) {
      // Once the guess is in, the globe is a static reveal and the player needs
      // to scroll past it to the results — so let the wheel through rather than
      // swallowing it to zoom. The +/- buttons still zoom. During play the whole
      // board fits one viewport, so there is nothing to scroll and zoom wins.
      if (!wheelZoom || !interactive || revealActive || pinLocked) return;
      e.preventDefault();
      resize();
      cam.scale = clampScale(cam.scale * Math.exp(-e.deltaY * 0.001));
      scheduleRender();
    }

    // Handlers are always attached; `interactive` gates them. That lets a
    // reveal-only globe switch free-look on AFTER its reveal finishes without
    // re-binding anything (setInteractive).
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    /** Turn drag/zoom on or off at runtime. Also flips the `is-interactive`
     * class so a game's CSS can own the grab cursor, and takes touch-action off
     * the browser (the arcade's global `touch-action: manipulation` would still
     * let it pan/zoom) — we drive every gesture ourselves while interactive. */
    function setInteractive(on) {
      interactive = !!on;
      if (!interactive) { pointers.clear(); tap = null; pinchPrev = 0; pinchMid = null; }
      canvas.classList.toggle('is-interactive', interactive);
      canvas.style.touchAction = interactive ? 'none' : '';
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { scheduleRender(); });
      ro.observe(canvas);
    }
    function onWinResize() { scheduleRender(); }
    window.addEventListener('resize', onWinResize);

    // Colors are read from CSS custom properties on every render, so a theme
    // flip only lands if something repaints. Nothing else does — without this
    // the globe keeps the old palette until the next drag/zoom/reveal frame.
    var themeMO = null;
    if (window.MutationObserver) {
      themeMO = new MutationObserver(function () { scheduleRender(); });
      themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // ── Reveal timeline (rAF with a timeout backstop for hidden tabs) ─────────
    var raf = null, backstop = null, skipFn = null;
    function nextFrame(cb) {
      raf = requestAnimationFrame(function (t) { clearTimeout(backstop); backstop = null; cb(t); });
      backstop = setTimeout(function () {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        cb(performance.now ? performance.now() : Date.now());
      }, 120);
    }
    function cancelFrame() {
      if (raf) cancelAnimationFrame(raf);
      if (backstop) clearTimeout(backstop);
      raf = null; backstop = null;
    }

    // ── Guess reveal (where-in-the-world): north-up ease → grow arc → pulse ───
    // job: { guess:{lat,lon}, answer:{lat,lon}, gapKm, tier:'good'|'warn'|'bad',
    //        caption, done() }
    function playGuessReveal(job) {
      stop();
      resize();
      job = job || {};
      var guess = job.guess, answer = job.answer;
      if (!guess || !answer) { if (job.done) job.done(); return; }
      var gapKm = job.gapKm != null ? job.gapKm : distanceKm(guess.lat, guess.lon, answer.lat, answer.lon);
      var tier = job.tier || 'warn';
      var caption = job.caption != null ? job.caption : (Math.round(gapKm).toLocaleString() + ' km');
      var arcPts = sampleBetween(guess, answer);
      var mid = arcPts[Math.floor(arcPts.length / 2)];
      var targetScale = scaleForKm(clamp(gapKm * 2.6, 1200, 22000));

      pinLocked = true;
      revealActive = true;
      cam.roll = 0;
      scene = { guess: { lat: guess.lat, lon: guess.lon }, answer: { lat: answer.lat, lon: answer.lon },
                tier: tier, gapArc: [], answerPulse: 0, caption: caption, showAnswer: false };

      var fromLat = cam.lat0, fromLon = cam.lon0, fromScale = cam.scale;

      function finalFrame() {
        cam.lat0 = mid.lat; cam.lon0 = mid.lon; cam.scale = targetScale;
        scene.gapArc = arcPts; scene.showAnswer = true; scene.answerPulse = 0;
        render();
      }

      var finished = false, pi = 0, phaseStart = null;
      function finish() {
        if (finished) return;
        finished = true;
        cancelFrame();
        skipFn = null;
        finalFrame();
        revealActive = false; // drag/zoom re-enabled; pin stays locked
        if (job.done) job.done();
      }
      skipFn = finish;

      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        finalFrame();
        backstop = setTimeout(finish, 400);
        return;
      }

      var phases = [
        { dur: 900, update: function (t) { // ease camera to the arc midpoint
            var e = easeInOutCubic(t);
            cam.lat0 = lerp(fromLat, mid.lat, e);
            cam.lon0 = angleLerp(fromLon, mid.lon, e);
            cam.scale = Math.exp(lerp(Math.log(fromScale), Math.log(targetScale), e));
          } },
        { dur: 750, start: function () { scene.showAnswer = true; }, // grow the arc
          update: function (t) {
            scene.gapArc = arcPts.slice(0, Math.max(2, Math.round(arcPts.length * easeInOutCubic(t))));
            scene.answerPulse = (t * 3) % 1;
          } },
        { dur: 700, update: function (t) { // settle + pulse the answer pin
            scene.gapArc = arcPts;
            scene.answerPulse = (t * 2) % 1;
          } }
      ];

      function tick(now) {
        if (finished) return;
        if (phaseStart == null) {
          phaseStart = now;
          if (phases[pi].start) phases[pi].start();
        }
        var t = (now - phaseStart) / phases[pi].dur;
        if (t >= 1) {
          phases[pi].update(1);
          pi++; phaseStart = null;
          if (pi >= phases.length) { finish(); return; }
          nextFrame(tick);
          return;
        }
        phases[pi].update(t);
        render();
        nextFrame(tick);
      }
      nextFrame(tick);
    }

    // ── Dart-flight reveal (true-north): orient → throw → fly → impact → measure
    // job: { origin:{lat,lon}, heading, bearing, distKm, landing:{lat,lon},
    //        target:{lat,lon,emoji,name}, gapKm, tier:'good'|'warn'|'bad' }
    // cb:  { caption(text), done() }
    function playReveal(job, cb) {
      stop();
      resize();
      var origin = job.origin, target = job.target, landing = job.landing;
      var d = job.distKm;

      // Course (true bearing of travel) at distance s along the throw.
      function courseAt(s) {
        var p = destination(origin.lat, origin.lon, job.bearing, s);
        var q = destination(origin.lat, origin.lon, job.bearing, s + 40);
        return bearingTo(p.lat, p.lon, q.lat, q.lon);
      }

      // The throw's ENTIRE great circle (2·antipodal = 2πR ≈ 40,030 km), sampled
      // once — ~334 points, cached for the whole reveal, never per-frame.
      var fullCirclePts = sampleGeodesic(origin, job.bearing, 0, 2 * HALF_LAP_KM);
      var STEP = 2 * HALF_LAP_KM / (fullCirclePts.length - 1); // km per cached sample

      // Rest view: look roughly down the great circle's pole so the ring reads
      // as an ellipse. Pole = 90° off the origin along bearing ±90; pick the one
      // nearer the TARGET so the target sits on the viewing hemisphere.
      var QUARTER = HALF_LAP_KM / 2;                    // 90°, ≈ 10,007 km
      var polePlus  = destination(origin.lat, origin.lon, job.bearing + 90, QUARTER);
      var poleMinus = destination(origin.lat, origin.lon, job.bearing - 90, QUARTER);
      var pole = distanceKm(polePlus.lat, polePlus.lon, target.lat, target.lon) <=
                 distanceKm(poleMinus.lat, poleMinus.lon, target.lat, target.lon)
                 ? polePlus : poleMinus;                // tie → polePlus, deterministic

      var gapPts = sampleBetween(landing, target);
      var mid = gapPts[Math.floor(gapPts.length / 2)];  // landing↔target midpoint
      // Pull the camera center HALF-way from the pole toward that midpoint so the
      // ring tilts into a strong ellipse while both landing and target stay front-side.
      var arcPM = distanceKm(pole.lat, pole.lon, mid.lat, mid.lon);
      var restCenter = arcPM < 1 ? mid
        : destination(pole.lat, pole.lon,
                      bearingTo(pole.lat, pole.lon, mid.lat, mid.lon), 0.5 * arcPM);
      var restScale = size * 0.46;                      // wide framing — whole globe with margin

      // Close-up framing for the measure: fit the landing↔target gap.
      var sigma = distanceKm(landing.lat, landing.lon, target.lat, target.lon) / EARTH_KM; // radians
      var gapScale = Math.min(
        scaleForKm(4000),
        Math.max(size * 0.46, 0.72 * (size / 2) / Math.max(Math.sin(sigma / 2), 0.12))
      );
      var needCloseup = gapScale > restScale * 1.15; // only when meaningfully closer

      var zoomIn = scaleForKm(3200);
      var zoomFlight = scaleForKm(Math.max(6000, Math.min(d * 1.1, 14000)));

      scene = {
        alpha: 0,
        origin: origin,
        target: null,          // hidden until the flight starts
        trail: [],
        dart: null,
        landing: null,
        gapArc: null,
        tier: job.tier,
        pulse: 0,
        targetPulse: 0,
        impact: null,
        fullCircle: fullCirclePts,
        circleAlpha: 0
      };
      cam.lat0 = origin.lat; cam.lon0 = origin.lon;
      cam.roll = job.heading; cam.scale = zoomIn;

      var flightDur = 1200 + 2300 * Math.min(d / 20000, 1.6);
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function gapCaption(km) { return Math.round(km).toLocaleString() + ' km from ' + target.name + ', as the crow flies'; }
      var gapText = gapCaption(job.gapKm);

      var phases = [
        { // 1 — orient: you are here, globe matches the phone
          dur: 1000,
          start: function () { cb.caption('You are here — the globe matches your phone'); },
          update: function (t) {
            scene.alpha = Math.min(1, t * 2);
            scene.pulse = (t * 2) % 1;
          }
        },
        { // 2 — launch: rotate throw-direction up, pull back a touch
          dur: 700,
          start: function () {
            cb.caption('Throwing ' + Math.round(d).toLocaleString() + ' km…');
            scene.target = target;
          },
          update: function (t) {
            var e = easeInOutCubic(t);
            cam.roll = angleLerp(job.heading, job.bearing, e);
            cam.scale = lerp(zoomIn, zoomFlight, e);
            scene.pulse = null;
          }
        },
        { // 3 — flight along the great circle; camera rides the dart, travel-up.
          //     Re-centered on the dart with roll = course, the geodesic ahead
          //     projects as a straight vertical line while the globe turns beneath.
          dur: flightDur,
          update: function (t) {
            var s = easeInOutCubic(t) * d;
            var p = destination(origin.lat, origin.lon, job.bearing, s);
            var course = courseAt(Math.min(s, Math.max(0, d - 40)));
            var k = Math.max(1, Math.floor(s / STEP));
            scene.trail = fullCirclePts.slice(0, k + 1);
            scene.trail.push(p);                      // exact dart tip
            scene.dart = { lat: p.lat, lon: p.lon, course: course };
            scene.targetPulse = (t * 4) % 1;
            scene.circleAlpha = easeInOutCubic(t);    // fade the full circle in
            cam.lat0 = p.lat; cam.lon0 = p.lon;       // camera centered on the dart
            cam.roll = course;                        // travel direction stays "up"
            cb.caption('Flying straight over the curve… ' + Math.round(s).toLocaleString() + ' km');
          }
        },
        { // 4 — impact
          dur: 600,
          start: function () {
            scene.dart = null;
            scene.landing = landing;
            cb.caption('Landed!');
          },
          update: function (t) { scene.impact = easeOutCubic(t); }
        },
        { // 5 — pull back and spin to the rest view: the whole great circle as a
          //     visible curve, north-up, with landing + target both in frame.
          dur: 1600,
          start: function () {
            this.fromLat = cam.lat0; this.fromLon = cam.lon0;
            this.fromRoll = cam.roll; this.fromScale = cam.scale;
            scene.impact = null;
          },
          update: function (t) {
            var e = easeInOutCubic(t);
            cam.lat0 = lerp(this.fromLat, restCenter.lat, e);
            cam.lon0 = angleLerp(this.fromLon, restCenter.lon, e);
            cam.roll = angleLerp(this.fromRoll, 0, e);
            cam.scale = Math.exp(lerp(Math.log(this.fromScale), Math.log(restScale), e));
            scene.targetPulse = (t * 3) % 1;
          }
        },
        { // 6 — measure the gap (great circle), rest view held.
          dur: 1300,
          update: function (t) {
            var e = easeInOutCubic(t);
            var n = Math.max(2, Math.round(gapPts.length * e));
            scene.gapArc = gapPts.slice(0, n);
            scene.targetPulse = 0;
            cb.caption(gapCaption(job.gapKm * e));
          }
        }
      ];

      if (needCloseup) phases.push({ // 7 — glide in so a near-miss is actually visible
        dur: 1100,
        start: function () { this.fromLat = cam.lat0; this.fromLon = cam.lon0; this.fromScale = cam.scale; },
        update: function (t) {
          var e = easeInOutCubic(t);
          cam.lat0 = lerp(this.fromLat, mid.lat, e);
          cam.lon0 = angleLerp(this.fromLon, mid.lon, e);
          cam.scale = Math.exp(lerp(Math.log(this.fromScale), Math.log(gapScale), e));
        }
      });

      function finalFrame() {
        scene.alpha = 1;
        scene.pulse = null; scene.impact = null; scene.dart = null; scene.targetPulse = 0;
        scene.target = target; scene.landing = landing;
        scene.trail = sampleGeodesic(origin, job.bearing, 0, d);
        scene.fullCircle = fullCirclePts; scene.circleAlpha = 1;
        scene.gapArc = gapPts;
        cam.lat0 = needCloseup ? mid.lat : restCenter.lat;
        cam.lon0 = needCloseup ? mid.lon : restCenter.lon;
        cam.roll = 0;
        cam.scale = needCloseup ? gapScale : restScale;
        cb.caption(gapText);
        render();
      }

      if (reduced) {
        finalFrame();
        skipFn = null;
        cb.done();
        return;
      }

      var pi = 0, phaseStart = null, finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        cancelFrame();
        skipFn = null;
        finalFrame();
        cb.done();
      }
      skipFn = finish;

      function tick(now) {
        if (finished) return;
        if (phaseStart == null) {
          phaseStart = now;
          if (phases[pi].start) phases[pi].start();
        }
        var t = (now - phaseStart) / phases[pi].dur;
        if (t >= 1) {
          phases[pi].update(1);
          pi++;
          phaseStart = null;
          if (pi >= phases.length) { finish(); return; }
          nextFrame(tick);
          return;
        }
        phases[pi].update(t);
        render();
        nextFrame(tick);
      }
      nextFrame(tick);
    }

    function stop() {
      cancelFrame();
      skipFn = null;
      revealActive = false;
    }
    function skip() { if (skipFn) skipFn(); }

    /** Undo a reveal completely: drop the scene (arc, pins, caption) AND return
     * the camera home. Deliberately separate from stop(): stop() also runs when
     * a reveal finishes normally, where the final frame must stay on screen. Call
     * this when starting a new round — otherwise the previous round's arc lingers
     * and the camera stays parked on (and quietly hints at) the last answer. */
    function clearReveal() {
      stop();
      scene = null;
      resize();
      cam.lat0 = HOME_VIEW.lat0;
      cam.lon0 = HOME_VIEW.lon0;
      cam.roll = 0;
      cam.scale = scaleForKm(HOME_VIEW.km);
      scheduleRender();
    }

    // ── Public instance API ───────────────────────────────────────────────────
    function setPin(v) {
      pin = v ? { lat: v.lat, lon: v.lon } : null;
      scheduleRender();
    }
    function getPin() { return pin ? { lat: pin.lat, lon: pin.lon } : null; }
    function setView(v) {
      if (!v) return;
      resize();
      if (v.lat != null) cam.lat0 = clamp(v.lat, -85, 85);
      if (v.lon != null) cam.lon0 = v.lon;
      if (v.km != null) cam.scale = clampScale(scaleForKm(v.km));
      scheduleRender();
    }
    function zoomBy(factor) {
      resize();
      cam.scale = clampScale(cam.scale * (factor || 1));
      scheduleRender();
    }
    function lockPin() { pinLocked = true; }
    function unlockPin() { pinLocked = false; }
    function destroy() {
      stop();
      if (pendingRAF) { cancelAnimationFrame(pendingRAF); pendingRAF = null; }
      if (pendingTO) { clearTimeout(pendingTO); pendingTO = null; }
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onWinResize);
      if (ro) { ro.disconnect(); ro = null; }
      if (themeMO) { themeMO.disconnect(); themeMO = null; }
      pointers.clear();
      if (window.__arcadeGlobeDebug && window.__arcadeGlobeDebug.canvas === canvas) {
        try { delete window.__arcadeGlobeDebug; } catch (_) { window.__arcadeGlobeDebug = null; }
      }
    }

    var api = {
      render: render,
      skip: skip,
      stop: stop,
      cam: cam,
      playGuessReveal: playGuessReveal,
      playReveal: playReveal,
      setInteractive: setInteractive,
      setPin: setPin,
      getPin: getPin,
      setView: setView,
      clearReveal: clearReveal,
      destroy: destroy,
      zoomBy: zoomBy,
      lockPin: lockPin,
      unlockPin: unlockPin
    };

    // Debug handle (verification hooks onto this). Harmless in production.
    try { window.__arcadeGlobeDebug = { api: api, cam: cam, canvas: canvas }; } catch (_) {}

    setInteractive(!!opts.interactive);
    resize();
    render();
    return api;
  }

  // Statics accept either two {lat,lon} objects or raw scalars (first arg decides).
  function distanceKmAPI(a, b, c, d) {
    if (a && typeof a === 'object') return distanceKm(a.lat, a.lon, b.lat, b.lon);
    return distanceKm(a, b, c, d);
  }
  function bearingToAPI(a, b, c, d) {
    if (a && typeof a === 'object') return bearingTo(a.lat, a.lon, b.lat, b.lon);
    return bearingTo(a, b, c, d);
  }
  function destinationAPI(a, b, c, d) {
    if (a && typeof a === 'object') return destination(a.lat, a.lon, b, c);
    return destination(a, b, c, d);
  }

  window.ArcadeGlobe = {
    create: create,
    distanceKm: distanceKmAPI,
    bearingTo: bearingToAPI,
    destination: destinationAPI,
    // Canonical Earth constants — a game must never re-derive these (or the
    // haversine above) locally; that duplication is exactly what this module exists
    // to kill.
    EARTH_KM: EARTH_KM,
    HALF_LAP_KM: HALF_LAP_KM,
    // Exposed for unit tests (pure projection math — not part of the game API).
    _internal: {
      latLonToVec: latLonToVec, vecToLatLon: vecToLatLon, makeRot: makeRot,
      viewVec: viewVec, invViewVec: invViewVec, project: project, unproject: unproject
    }
  };
})();
