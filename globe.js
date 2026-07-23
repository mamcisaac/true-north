// As the Crow Flies (slug: true-north) — canvas orthographic globe + dart-flight reveal.
// Hand-rolled projection (no deps): rotate lat/lon unit vectors into view
// space, hemisphere-clip via the view-axis component, roll the screen so an
// arbitrary true bearing points "up" (this is how the globe matches the
// direction the phone is physically facing).
//
// Exposes window.TNGlobe = { create(canvas), destination, bearingTo, distanceKm }.
(function () {
  'use strict';

  var D2R = Math.PI / 180;
  var EARTH_KM = 6371;
  var HALF_LAP_KM = Math.PI * EARTH_KM; // ~20015 km, antipodal distance

  // ── Geodesy (duplicated from game.js so this module is self-contained) ────
  function bearingTo(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * D2R, f2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    var y = Math.sin(dl) * Math.cos(f2);
    var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return ((Math.atan2(y, x) / D2R) + 360) % 360;
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    var f1 = lat1 * D2R, f2 = lat2 * D2R;
    var df = (lat2 - lat1) * D2R, dl = (lon2 - lon1) * D2R;
    var a = Math.sin(df / 2) * Math.sin(df / 2) +
            Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  // Forward geodesic: start point + true bearing + distance → end point.
  // The dart path is THIS evaluated at partial distances — never a slerp
  // between endpoints, which would fly the short way for throws past the
  // antipode (>20,015 km).
  function destination(lat, lon, bearingDeg, distKm) {
    var d = distKm / EARTH_KM, th = bearingDeg * D2R;
    var f1 = lat * D2R, l1 = lon * D2R;
    var sf1 = Math.sin(f1), cf1 = Math.cos(f1);
    var sd = Math.sin(d), cd = Math.cos(d);
    var f2 = Math.asin(sf1 * cd + cf1 * sd * Math.cos(th));
    var l2 = l1 + Math.atan2(Math.sin(th) * sd * cf1, cd - sf1 * Math.sin(f2));
    var lon2 = ((l2 / D2R) + 540) % 360 - 180; // normalize to (-180, 180]
    return { lat: f2 / D2R, lon: lon2 };
  }

  // ── Angle helpers ──────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angleLerp(a, b, t) { // shortest way around
    var d = ((b - a + 540) % 360) - 180;
    return a + d * t;
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var size = 0, cx = 0, cy = 0, dpr = 1;

    // Pre-vectorized land: per ring, a Float64Array of unit-vector triples.
    var land = [];
    (window.WORLD_LAND || []).forEach(function (ring) {
      var n = ring.length / 2, v = new Float64Array(n * 3);
      for (var i = 0; i < n; i++) {
        var lon = ring[i * 2] * D2R, lat = ring[i * 2 + 1] * D2R;
        var cl = Math.cos(lat);
        v[i * 3] = cl * Math.cos(lon);
        v[i * 3 + 1] = cl * Math.sin(lon);
        v[i * 3 + 2] = Math.sin(lat);
      }
      land.push(v);
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || 320;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = canvas.height = Math.round(w * dpr);
      }
      size = canvas.width;
      cx = size / 2; cy = size / 2;
    }

    // Camera: {lat0, lon0, roll, scale}. scale = globe radius in canvas px.
    // roll = the true bearing that points to the top of the screen.
    var cam = { lat0: 0, lon0: 0, roll: 0, scale: 0 };

    // scale so the canvas width spans roughly `km` of ground at the center
    function scaleForKm(km) {
      var half = Math.min(km / 2 / EARTH_KM, Math.PI / 2 - 0.01);
      return (size / 2) / Math.sin(half);
    }

    // Per-frame rotation constants
    var _cl0, _sl0, _cf0, _sf0, _cr, _sr;
    function beginFrame() {
      var l0 = cam.lon0 * D2R, f0 = cam.lat0 * D2R, r = cam.roll * D2R;
      _cl0 = Math.cos(l0); _sl0 = Math.sin(l0);
      _cf0 = Math.cos(f0); _sf0 = Math.sin(f0);
      _cr = Math.cos(r); _sr = Math.sin(r);
    }
    // Rotate a unit vector into view space. Returns [x2 (toward viewer),
    // y2 (east), z2 (north)] — visible iff x2 > 0.
    function view(x, y, z) {
      var x1 = x * _cl0 + y * _sl0;
      var y1 = -x * _sl0 + y * _cl0;
      var x2 = x1 * _cf0 + z * _sf0;
      var z2 = -x1 * _sf0 + z * _cf0;
      return [x2, y1, z2];
    }
    // View-space → canvas px, applying the roll so bearing `roll` is up.
    function toScreen(y2, z2) {
      var xs = y2 * cam.scale, ys = -z2 * cam.scale;
      return [cx + xs * _cr + ys * _sr, cy + ys * _cr - xs * _sr];
    }
    function projectLL(lat, lon) { // → {x, y, visible}
      var f = lat * D2R, l = lon * D2R, cf = Math.cos(f);
      var v = view(cf * Math.cos(l), cf * Math.sin(l), Math.sin(f));
      var p = toScreen(v[1], v[2]);
      return { x: p[0], y: p[1], visible: v[0] > 0 };
    }
    function projectLoft(lat, lon, h) { // → {x, y, visible}
      var f = lat * D2R, l = lon * D2R, cf = Math.cos(f);
      var v = view(cf * Math.cos(l), cf * Math.sin(l), Math.sin(f));
      var r = 1 + h;
      var p = toScreen(v[1] * r, v[2] * r);
      // Visible unless it sits BEHIND the sphere (x2<=0) AND projects INSIDE the limb.
      var vis = v[0] > 0 || (r * r * (v[1] * v[1] + v[2] * v[2]) > 1);
      return { x: p[0], y: p[1], visible: vis };
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    function drawLandRing(vec) {
      var n = vec.length / 3, any = false, i;
      for (i = 0; i < n; i++) if (view(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2])[0] > 0) { any = true; break; }
      if (!any) return false;
      for (i = 0; i < n; i++) {
        var v = view(vec[i * 3], vec[i * 3 + 1], vec[i * 3 + 2]);
        var y2 = v[1], z2 = v[2];
        if (v[0] <= 0) { // behind the globe: clamp onto the limb circle
          var m = Math.sqrt(y2 * y2 + z2 * z2) || 1;
          y2 /= m; z2 /= m;
        }
        var p = toScreen(y2, z2);
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      return true;
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
    // Polyline through {lat, lon, h} points, breaking at occlusion (mirror of drawGeoPath).
    function drawLoftPath(pts) {
      var started = false;
      for (var i = 0; i < pts.length; i++) {
        var p = projectLoft(pts[i].lat, pts[i].lon, pts[i].h || 0);
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

    // scene: everything playReveal mutates per frame; render() just draws it.
    var scene = null;

    function render() {
      resize();
      beginFrame();
      var colors = {
        // Ocean must read as WATER against the page — the Penny Arcade elevation
        // is near-cream, so key off the navy tone (navy in light / blue in dark)
        // for a proper map globe instead of a washed cream-on-cream disc.
        ocean: cssVar('--tone-sky-fg', '#33628f'),
        land: cssVar('--border-strong', '#334155'),
        graticule: cssVar('--border', '#1e293b'),
        accent: cssVar('--accent', '#5eead4'),
        fg: cssVar('--fg', '#e2e8f0'),
        target: cssVar('--tone-rose-fg', '#fb7185'),
        good: cssVar('--good', '#22c55e'),
        warn: cssVar('--warn', '#eab308'),
        bad: cssVar('--bad', '#ef4444')
      };

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.globalAlpha = scene && scene.alpha != null ? scene.alpha : 1;

      // Ocean disc doubles as the clip region for everything on the globe.
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cam.scale, size), 0, Math.PI * 2);
      ctx.fillStyle = colors.ocean;
      ctx.fill();
      ctx.save();
      ctx.clip();

      // Land
      ctx.beginPath();
      for (var i = 0; i < land.length; i++) drawLandRing(land[i]);
      ctx.fillStyle = colors.land;
      ctx.globalAlpha *= 0.85;
      ctx.fill('evenodd');
      ctx.globalAlpha = scene && scene.alpha != null ? scene.alpha : 1;

      drawGraticule(colors);

      if (scene) {
        // Ground-track shadow: faint on-surface projection of the lofted trail.
        if (scene.trail && scene.trail.length > 1) {
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.5 * dpr;
          ctx.lineCap = 'round';
          ctx.globalAlpha *= 0.28;
          ctx.beginPath();
          drawGeoPath(scene.trail);
          ctx.stroke();
          ctx.globalAlpha = scene && scene.alpha != null ? scene.alpha : 1;
        }
        // Gap arc (dashed, tier-colored)
        if (scene.gapArc && scene.gapArc.length > 1) {
          ctx.strokeStyle = colors[scene.tier || 'warn'];
          ctx.lineWidth = 2.5 * dpr;
          ctx.setLineDash([6 * dpr, 5 * dpr]);
          ctx.beginPath();
          drawGeoPath(scene.gapArc);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Origin
        if (scene.origin) {
          var op = dot(scene.origin.lat, scene.origin.lon, 4, colors.accent);
          if (op && scene.pulse != null) ringAt(op, 4 + 10 * scene.pulse, colors.accent, 2, 1 - scene.pulse);
        }
        // Target pin (visible whenever on the front hemisphere)
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
        // Landing marker + impact rings
        if (scene.landing) {
          var lp = dot(scene.landing.lat, scene.landing.lon, 4, colors.fg);
          if (lp && scene.impact != null) {
            ringAt(lp, 5 + 22 * scene.impact, colors.fg, 2, 1 - scene.impact);
            ringAt(lp, 5 + 12 * scene.impact, colors.fg, 2, 1 - scene.impact);
          }
        }
      }

      ctx.restore(); // un-clip
      // Limb outline
      ctx.strokeStyle = colors.graticule;
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(cam.scale, size * 2), 0, Math.PI * 2);
      ctx.stroke();

      // Lofted flight trail (drawn OUTSIDE the clip so it may rise past the limb)
      if (scene && scene.trail && scene.trail.length > 1) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2.5 * dpr; ctx.lineCap = 'round';
        ctx.beginPath(); drawLoftPath(scene.trail); ctx.stroke();
      }
      // Dart, riding the top of the arc
      if (scene && scene.dart) {
        var dp = projectLoft(scene.dart.lat, scene.dart.lon, scene.dart.h || 0);
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

      ctx.restore();
    }

    // ── Reveal timeline ──────────────────────────────────────────────────────
    // job: { origin:{lat,lon}, heading, bearing, distKm, landing:{lat,lon},
    //        target:{lat,lon,emoji,name}, gapKm, tier:'good'|'warn'|'bad' }
    // cb:  { caption(text), done() }
    var raf = null, backstop = null, skipFn = null;
    // rAF for smoothness, with a timeout backstop so the timeline still
    // advances when rAF is suspended (hidden/backgrounded tab).
    function nextFrame(cb) {
      raf = requestAnimationFrame(function (t) {
        clearTimeout(backstop); backstop = null; cb(t);
      });
      backstop = setTimeout(function () {
        cancelAnimationFrame(raf); raf = null; cb(performance.now());
      }, 120);
    }
    function cancelFrame() {
      if (raf) cancelAnimationFrame(raf);
      if (backstop) clearTimeout(backstop);
      raf = null; backstop = null;
    }

    function sampleGeodesic(origin, bearing, fromKm, toKm) {
      var pts = [], stepKm = 120; // ~1° — smooth at any zoom we use
      var n = Math.max(2, Math.ceil((toKm - fromKm) / stepKm));
      for (var i = 0; i <= n; i++) {
        pts.push(destination(origin.lat, origin.lon, bearing, fromKm + (toKm - fromKm) * i / n));
      }
      return pts;
    }
    function sampleBetween(a, b) { // gap arc: a→b along their great circle
      var d = distanceKm(a.lat, a.lon, b.lat, b.lon);
      if (d < 1) return [a, b];
      return sampleGeodesic(a, bearingTo(a.lat, a.lon, b.lat, b.lon), 0, d);
    }

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

      // Builds the flight trail with an added altitude arc: 0 at both ends,
      // apex (loftAmp) at the midpoint of the FULL throw distance d.
      function loftedTrail(toKm) {
        var pts = sampleGeodesic(origin, job.bearing, 0, toKm);
        var n = pts.length - 1;
        for (var i = 0; i <= n; i++) {
          var dist = toKm * i / n;
          var frac = d > 0 ? Math.min(dist / d, 1) : 0;
          pts[i].h = loftAmp * Math.sin(Math.PI * frac);
        }
        return pts;
      }

      var OFFSET_FRAC = 0.32;                                  // dart sits ~32% of globe-radius off center
      var camOffsetKm = Math.asin(OFFSET_FRAC) * EARTH_KM;     // ≈ 2076 km

      // Framing for the measure phase: center between landing & target,
      // zoomed to fit both.
      var gapPts = sampleBetween(landing, target);
      var mid = gapPts[Math.floor(gapPts.length / 2)];
      var sigma = distanceKm(landing.lat, landing.lon, target.lat, target.lon) / EARTH_KM; // radians
      var frameScale = Math.min(
        scaleForKm(4000),
        Math.max(size * 0.46, 0.72 * (size / 2) / Math.max(Math.sin(sigma / 2), 0.12))
      );
      var gapBearing = bearingTo(mid.lat, mid.lon, target.lat, target.lon);
      // Perpendicular offset angle: proportional to the gap for small gaps, capped mid-range,
      // and forced back toward 0 as the gap approaches antipodal (else an endpoint falls behind the limb).
      var frameOffAng = Math.min(0.35 * sigma, 0.30, Math.max(0, 1.40 - sigma / 2));
      var frameCenter = destination(mid.lat, mid.lon, gapBearing + 90, frameOffAng * EARTH_KM);

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
        impact: null
      };
      cam.lat0 = origin.lat; cam.lon0 = origin.lon;
      cam.roll = job.heading; cam.scale = zoomIn;

      var flightDur = 1200 + 2300 * Math.min(d / 20000, 1.6);
      // Loft amplitude as a fraction of Earth radius. Grows with throw distance,
      // capped so even antipodal throws don't balloon past a readable arc.
      var loftAmp = 0.08 + 0.24 * Math.min(d / HALF_LAP_KM, 1); // 0.08 .. 0.32
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var gapText = Math.round(job.gapKm).toLocaleString() + ' km from ' + target.name + ', as the crow flies';

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
        { // 3 — flight along the geodesic, camera chasing the dart, offset so the dart doesn't sit dead-center
          dur: flightDur,
          update: function (t) {
            var s = easeInOutCubic(t) * d;
            var p = destination(origin.lat, origin.lon, job.bearing, s);
            var course = courseAt(Math.min(s, d - 40));
            scene.trail = loftedTrail(Math.max(s, 1));
            var frac = d > 0 ? Math.min(s / d, 1) : 0;
            scene.dart = { lat: p.lat, lon: p.lon, course: course, h: loftAmp * Math.sin(Math.PI * frac) };
            scene.targetPulse = (t * 4) % 1;
            // Ramp the offset in over the first 20% of flight to avoid a pop at the phase 2→3 seam.
            var offKm = camOffsetKm * Math.min(1, t / 0.20);
            var off = destination(p.lat, p.lon, course + 90, offKm);
            cam.lat0 = off.lat; cam.lon0 = off.lon;
            cam.roll = course;                          // travel direction stays "up"
            cb.caption('Flying… ' + Math.round(s).toLocaleString() + ' km');
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
        { // 5 — pull back to frame landing + target, north-up
          dur: 1300,
          start: function () { this.fromLat = cam.lat0; this.fromLon = cam.lon0; this.fromRoll = cam.roll; this.fromScale = cam.scale; },
          update: function (t) {
            var e = easeInOutCubic(t);
            cam.lat0 = lerp(this.fromLat, frameCenter.lat, e);
            cam.lon0 = angleLerp(this.fromLon, frameCenter.lon, e);
            cam.roll = angleLerp(this.fromRoll, 0, e);
            cam.scale = Math.exp(lerp(Math.log(this.fromScale), Math.log(frameScale), e));
            scene.impact = null;
            scene.targetPulse = (t * 3) % 1;
          }
        },
        { // 6 — measure the gap
          dur: 1300,
          update: function (t) {
            var e = easeInOutCubic(t);
            var n = Math.max(2, Math.round(gapPts.length * e));
            scene.gapArc = gapPts.slice(0, n);
            scene.targetPulse = 0;
            cb.caption(Math.round(job.gapKm * e).toLocaleString() + ' km from ' + target.name + ', as the crow flies');
          }
        }
      ];

      function finalFrame() {
        scene.alpha = 1;
        scene.pulse = null; scene.impact = null; scene.dart = null; scene.targetPulse = 0;
        scene.target = target; scene.landing = landing;
        scene.trail = loftedTrail(d);
        scene.gapArc = gapPts;
        cam.lat0 = frameCenter.lat; cam.lon0 = frameCenter.lon; cam.roll = 0; cam.scale = frameScale;
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
    }
    function skip() { if (skipFn) skipFn(); }

    return {
      playReveal: playReveal,
      skip: skip,
      stop: stop,
      render: render,
      cam: cam
    };
  }

  window.TNGlobe = {
    create: create,
    destination: destination,
    bearingTo: bearingTo,
    distanceKm: distanceKm
  };
})();
