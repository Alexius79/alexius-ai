(() => {
  // ---- Frame = coordinate system of the front photo (1023 x 1537) ----
  const FW = 1023, FH = 1537, BODY_X = 500;
  const SIDE = { x: 309, y: 147, s: 0.52, w: 1084, h: 1451 };   // side photo aligned on the eyes of the front photo
  const CHEST = { x: 500, y: 760 };
  const HEAD_TOP = 209;

  const c = document.getElementById('c'), x = c.getContext('2d');
  const $ = id => document.getElementById(id);
  const R = Math.random, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, D, s, ox, oy;                // screen size, dpr, frame scale, frame offset
  let state = 'form', tTap = 0, t = 0, pulse = 0, rings = [];
  let TP = [], MP = [], EP = [];         // text particles, morph particles, edge particles
  const mouse = { x: -1e4, y: -1e4 };
  const imgSide = new Image(), imgFront = new Image();
  let loaded = 0, ready = false;

  const fx = px => ox + px * s, fy = py => oy + py * s;

  function layout() {
    D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
    s = Math.min(H * .92 / FH, W * 1.55 / FW);
    ox = W / 2 - BODY_X * s; oy = H - FH * s;
    buildText();
  }

  // ---- "alexius.ai" made of particles, floating above the head ----
  function buildText() {
    const o = document.createElement('canvas'), q = o.getContext('2d', { willReadFrequently: true });
    o.width = W; o.height = H;
    const fs = Math.min(W * .165, 120), ty = Math.max(70 + fs * .5, fy(HEAD_TOP) - fs * .72);
    q.fillStyle = '#fff'; q.textBaseline = 'middle';
    q.font = `900 ${fs}px Inter,Arial Black,Arial,sans-serif`; const w1 = q.measureText('alexius').width;
    q.font = `800 ${fs * .42}px Inter,Arial,sans-serif`; const w2 = q.measureText('.ai').width;
    const sx = W / 2 - (w1 + w2) / 2;
    q.font = `900 ${fs}px Inter,Arial Black,Arial,sans-serif`; q.fillText('alexius', sx, ty);
    q.font = `800 ${fs * .42}px Inter,Arial,sans-serif`; q.fillText('.ai', sx + w1 + fs * .04, ty + fs * .22);
    const d = q.getImageData(0, 0, W, H).data, st = W < 600 ? 3 : 4, pts = [];
    for (let y = 0; y < H; y += st) for (let i = 0; i < W; i += st) if (d[(y * W + i) * 4 + 3] > 128) pts.push([i, y]);
    const old = TP;
    TP = pts.map((p, k) => {
      const q2 = old[k] || { x: R() * W, y: R() * H, vx: 0, vy: 0 };
      q2.tx = p[0]; q2.ty = p[1]; q2.c = R(); q2.dl = R() * .45; q2.gone = state !== 'form';
      return q2;
    });
  }

  // ---- sample pixels of an image (in frame coordinates) ----
  function sample(img, place, n, edgeOnly) {
    const sc = .25, w = Math.round(img.width * sc), h = Math.round(img.height * sc);
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const q = o.getContext('2d', { willReadFrequently: true }); q.drawImage(img, 0, 0, w, h);
    const d = q.getImageData(0, 0, w, h).data, out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 60) {
      const i = (R() * w) | 0, j = (R() * h) | 0, k = (j * w + i) * 4, a = d[k + 3], l = d[k + 1] / 255;
      if (edgeOnly ? (a < 40 || a > 200) : a < 140) continue;
      if (!edgeOnly && R() > .3 + l) continue;
      out.push({ x: place.x + (i + R()) / sc * place.s, y: place.y + (j + R()) / sc * place.s, l, a: a / 255 });
    }
    return out;
  }

  function buildParticles() {
    const n = W < 600 ? 3200 : 5500;
    const src = sample(imgSide, SIDE, n), dst = sample(imgFront, { x: 0, y: 0, s: 1 }, n);
    const key = p => Math.floor(p.y / 24) * 1e4 + p.x;
    src.sort((a, b) => key(a) - key(b)); dst.sort((a, b) => key(a) - key(b));
    MP = src.map((p, i) => ({ sx: p.x, sy: p.y, sl: p.l, dx: dst[i].x, dy: dst[i].y, dl: dst[i].l, d: R() * .35, w: (R() - .5) * 80 }));
    EP = { side: sample(imgSide, SIDE, 260, true), front: sample(imgFront, { x: 0, y: 0, s: 1 }, 320, true) };
    for (const k in EP) for (const p of EP[k]) { p.ph = R(); p.sp = .15 + R() * .35; }
  }

  function glow(cx, cy, r, col) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  function drawImg(img, place, alpha) {
    if (alpha <= 0) return;
    const bob = reduce ? 0 : Math.sin(t * .02) * 1.5;
    const X = fx(place.x), Y = fy(place.y) + bob, w = img.width * place.s * s, h = img.height * place.s * s;
    x.globalAlpha = alpha; x.drawImage(img, X, Y, w, h);
    // faint cyan halo (cheap glow, no canvas filter needed)
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = alpha * .07;
    x.drawImage(img, X - 2, Y - 2, w + 4, h + 4);
    // rare, small glitch slice
    if (!reduce && (t % 420) < 6) {
      const sy = R() * h * .8, sh = 3 + R() * 8, dx = (R() - .5) * 14;
      x.globalAlpha = alpha * .6;
      x.drawImage(img, 0, sy / h * img.height, img.width, sh / h * img.height, X + dx, Y + sy, w, sh);
    }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  }

  function drawEdges(list, place, alpha) {
    if (alpha <= 0 || !list) return;
    x.fillStyle = 'rgb(170,240,255)';
    for (const p of list) {
      const life = (p.ph + t * .004 * p.sp) % 1;
      x.globalAlpha = alpha * .5 * Math.sin(life * Math.PI) * p.a;
      x.fillRect(fx(place.x) + (p.x - place.x) * s + Math.sin(life * 6 + p.ph * 9) * 3, fy(place.y) + (p.y - place.y) * s - life * 26, 1.4, 1.4);
    }
    x.globalAlpha = 1;
  }

  function frame() {
    t++;
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = '#03060a'; x.fillRect(0, 0, W, H);
    const T = state === 'form' ? 0 : (performance.now() - tTap) / 1000;
    glow(W / 2, fy(520), FH * s * .55, 'rgba(20,110,140,.14)');

    if (ready) {
      const flick = reduce ? 1 : .96 + R() * .04;
      const aSide = state === 'form' ? .92 * flick : (1 - clamp((T - .55) / .45)) * .92;
      const aFront = state === 'form' ? 0 : clamp((T - 1.9) / .8) * flick;
      const aMorph = state === 'form' ? 0 : clamp((T - .45) / .25) * (1 - clamp((T - 2.1) / .7));
      const front = { x: 0, y: 0, s: 1 };

      drawImg(imgSide, SIDE, aSide); drawEdges(EP.side, SIDE, aSide);
      drawImg(imgFront, front, aFront); drawEdges(EP.front, front, aFront);

      if (aMorph > 0) {           // the "turn": side portrait dissolves and re-forms as the front portrait
        const sz = W < 600 ? 1.6 : 2;
        for (let b = 0; b < 6; b++) {
          const lv = 90 + b * 33;
          x.fillStyle = `rgb(${lv * .9 | 0},${lv},${Math.min(255, lv + 20)})`;
          for (let i = b; i < MP.length; i += 6) {
            const p = MP[i], k = ease(clamp((T - .7 - p.d) / 1.25)), sw = Math.sin(k * Math.PI);
            const px = p.sx + (p.dx - p.sx) * k + sw * p.w, py = p.sy + (p.dy - p.sy) * k - sw * 30;
            x.globalAlpha = aMorph * (.55 + .45 * ((p.sl * (1 - k) + p.dl * k)));
            x.fillRect(fx(px), fy(py), sz, sz);
          }
        }
        x.globalAlpha = 1;
      }
    }

    // chest pulse
    const cx = fx(CHEST.x), cy = fy(CHEST.y);
    if (pulse > .01) { x.globalCompositeOperation = 'lighter'; glow(cx, cy, 30 + pulse * 70, `rgba(94,240,255,${Math.min(.45, pulse * .4)})`); x.globalCompositeOperation = 'source-over'; pulse *= .965; }
    for (const r of rings) { r.r += r.v; r.a *= .955; x.strokeStyle = `rgba(94,240,255,${r.a})`; x.lineWidth = 1.1; x.beginPath(); x.ellipse(cx, cy, r.r, r.r * .5, 0, 0, 7); x.stroke(); }
    rings = rings.filter(r => r.a > .02);

    // text particles
    const ps = W < 600 ? 1.6 : 2.2;
    if (state === 'form') {
      for (const p of TP) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dd = dx * dx + dy * dy;
        if (dd < 8000) { const f = (8000 - dd) / 8000 * 2.6, an = Math.atan2(dy, dx); p.vx += Math.cos(an) * f; p.vy += Math.sin(an) * f; }
        p.vx += (p.tx - p.x) * .03; p.vy += (p.ty - p.y + (reduce ? 0 : Math.sin(t * .03 + p.tx * .02) * 1.1)) * .03;
        p.vx *= .8; p.vy *= .8; p.x += p.vx; p.y += p.vy;
        const b = .6 + .4 * Math.sin(t * .05 + p.c * 6);
        x.fillStyle = p.c < .15 ? `rgba(255,255,255,${b})` : `rgba(94,240,255,${.6 + b * .4})`; x.fillRect(p.x, p.y, ps, ps);
      }
    } else {
      for (const p of TP) {
        if (p.gone) continue;
        const k = clamp((T - p.dl) / 1.05);
        if (k >= 1) { p.gone = true; pulse = Math.min(1.4, pulse + .01); if (R() < .008) rings.push({ r: 8, v: 2, a: .6 }); continue; }
        const e = ease(k), c1x = (p.x + cx) / 2 + (p.x - W / 2) * .5, c1y = Math.min(p.y, cy) - 60;
        const qx = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * c1x + e * e * cx, qy = (1 - e) * (1 - e) * p.y + 2 * (1 - e) * e * c1y + e * e * cy;
        x.fillStyle = `rgba(${200 + 55 * e | 0},250,255,${1 - e * .3})`; x.fillRect(qx, qy, ps * (1 - e * .6), ps * (1 - e * .6));
      }
      if (state === 'fly' && T > 2.9) {
        state = 'done'; rings.push({ r: 10, v: 2.6, a: .7 });
        $('main').classList.add('on'); $('st').textContent = 'Das bin ich';
      }
    }
    requestAnimationFrame(frame);
  }

  function go() {
    if (state !== 'form' || !ready) return;
    state = 'fly'; tTap = performance.now();
    $('hint').classList.add('off'); $('st').textContent = 'Übertragung…';
  }
  function reset() {
    state = 'form'; pulse = 0;
    for (const p of TP) { p.gone = false; p.x = fx(CHEST.x) + (R() - .5) * 20; p.y = fy(CHEST.y) + (R() - .5) * 20; p.vx = (R() - .5) * 30; p.vy = (R() - .5) * 30; }
    $('main').classList.remove('on'); $('hint').classList.remove('off'); $('st').textContent = 'Hologramm bereit';
  }

  c.addEventListener('click', go);
  $('again').addEventListener('click', e => { e.stopPropagation(); reset(); });
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  addEventListener('touchend', () => { mouse.x = mouse.y = -1e4; });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const pw = W; layout(); if (pw && W < 600 !== pw < 600) buildParticles(); }, 150); });

  const onload = () => { if (++loaded === 2) { buildParticles(); ready = true; } };
  imgSide.onload = imgFront.onload = onload;
  imgSide.src = 'side.webp'; imgFront.src = 'front.webp';
  layout(); frame();
})();
