(() => {
  // Frame = coordinate system of the front photo (1023 x 1537 px)
  const FW = 1023, FH = 1537, BODY_X = 500;
  const SIDE = { x: 0, y: 0, s: 0.8, w: 1084, h: 1451 };   // placement of the side photo, set in layout()
  const FRONT = { x: 0, y: 0, s: 1 };
  const CHEST = { x: 500, y: 760 }, FACE = { x: 528, y: 470 }, EYE = { x: 481, y: 386 };
  const ARM = { x: 330, y: 1010 }, WATCH = { x: 355, y: 1047, r: 27 }, BROW = { x: 528, y: 330 };

  // ---- content & language (texts live in i18n.js) ----
  const LANGS = ['de', 'en', 'ru'];
  let lang = 'de', PROJECTS, STATS, SKILLS, STATIONS;
  const L = () => window.I18N[lang];
  function loadContent() {
    const d = L(); PROJECTS = d.projects; STATS = d.stats; SKILLS = d.skills;
    STATIONS = d.stations.map((q, i) => ({ y: q[0], n: q[1], d: q[2], p: window.STATION_POINTS[i] }));
  }
  loadContent();

  const c = document.getElementById('c'), x = c.getContext('2d');
  const $ = id => document.getElementById(id);
  const R = Math.random, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W, H, D, s, ox, oy, textY;
  let state = 'form', tTap = 0, t = 0, pulse = 0, rings = [];
  let TP = [], MP = [], EP = {};
  const mouse = { x: -1e4, y: -1e4 };
  const imgSide = new Image(), imgFront = new Image();
  let loaded = 0, ready = false, worldA = 1, worldAT = 1, watchA = 0, watchT0 = 0;
  // camera: focus point P (screen coords at zoom 1) is shown at anchor A with zoom z
  const cam = { z: 1, px: 0, py: 0, ax: 0, ay: 0 }, camT = { z: 1, px: 0, py: 0, ax: 0, ay: 0 };

  const fx = px => ox + px * s, fy = py => oy + py * s;

  function layout() {
    D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    c.width = W * D; c.height = H * D;
    s = Math.min(H * .92 / FH, W * 1.55 / FW);
    ox = W / 2 - BODY_X * s; oy = H - FH * s;
    // side photo: large, face in the upper third, slightly right of centre (he looks to the left)
    SIDE.s = W < 600 ? .82 : .78;
    SIDE.x = 560 - 450 * SIDE.s;
    SIDE.y = ((H * .31 - oy) / s) - 560 * SIDE.s;
    textY = H * .75;
    camRest(true);
    buildText();
    placeMenu();
  }

  function camRest(snap) {
    Object.assign(camT, { z: 1, px: W / 2, py: H / 2, ax: W / 2, ay: H / 2 });
    if (snap) Object.assign(cam, camT);
  }

  // "alexius.ai" made of particles, centred on the screen
  function buildText() {
    const o = document.createElement('canvas'), q = o.getContext('2d', { willReadFrequently: true });
    o.width = W; o.height = H;
    const fs = Math.min(W * .165, 120);
    q.fillStyle = '#fff'; q.textBaseline = 'middle';
    q.font = `900 ${fs}px Inter,Arial Black,Arial,sans-serif`; const w1 = q.measureText('alexius').width;
    q.font = `800 ${fs * .42}px Inter,Arial,sans-serif`; const w2 = q.measureText('.ai').width;
    const sx = W / 2 - (w1 + w2) / 2;
    q.font = `900 ${fs}px Inter,Arial Black,Arial,sans-serif`; q.fillText('alexius', sx, textY);
    q.font = `800 ${fs * .42}px Inter,Arial,sans-serif`; q.fillText('.ai', sx + w1 + fs * .04, textY + fs * .22);
    const d = q.getImageData(0, 0, W, H).data, st = W < 600 ? 3 : 4, pts = [];
    for (let y = 0; y < H; y += st) for (let i = 0; i < W; i += st) if (d[(y * W + i) * 4 + 3] > 128) pts.push([i, y]);
    const old = TP;
    TP = pts.map((p, k) => {
      const q2 = old[k] || { x: R() * W, y: R() * H, vx: 0, vy: 0 };
      q2.tx = p[0]; q2.ty = p[1]; q2.c = R(); q2.dl = R() * .45; q2.gone = state !== 'form';
      return q2;
    });
    TP.fs = fs;
  }

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
    const src = sample(imgSide, SIDE, n), dst = sample(imgFront, FRONT, n);
    const key = p => Math.floor(p.y / 24) * 1e4 + p.x;
    src.sort((a, b) => key(a) - key(b)); dst.sort((a, b) => key(a) - key(b));
    MP = src.map((p, i) => ({ sx: p.x, sy: p.y, sl: p.l, dx: dst[i].x, dy: dst[i].y, dl: dst[i].l, d: R() * .35, w: (R() - .5) * 80 }));
    EP = { side: sample(imgSide, SIDE, 260, true), front: sample(imgFront, FRONT, 320, true) };
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
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = alpha * .06;
    x.drawImage(img, X - 2, Y - 2, w + 4, h + 4);
    if (!reduce && (t % 420) < 6) {
      const sy = R() * h * .8, sh = 3 + R() * 8, dx = (R() - .5) * 14;
      x.globalAlpha = alpha * .6;
      x.drawImage(img, 0, sy / h * img.height, img.width, sh / h * img.height, X + dx, Y + sy, w, sh);
    }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  }

  function drawEdges(list, alpha) {
    if (alpha <= 0 || !list) return;
    x.fillStyle = 'rgb(170,240,255)';
    for (const p of list) {
      const life = (p.ph + t * .004 * p.sp) % 1;
      x.globalAlpha = alpha * .5 * Math.sin(life * Math.PI) * p.a;
      x.fillRect(fx(p.x) + Math.sin(life * 6 + p.ph * 9) * 3, fy(p.y) - life * 26, 1.4, 1.4);
    }
    x.globalAlpha = 1;
  }

  function frame() {
    t++;
    const k = reduce ? 1 : .07;
    for (const key in camT) cam[key] += (camT[key] - cam[key]) * k;

    x.setTransform(D, 0, 0, D, 0, 0);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = '#03060a'; x.fillRect(0, 0, W, H);

    // world layer (photos) – affected by the camera
    x.save();
    x.translate(cam.ax, cam.ay); x.scale(cam.z, cam.z); x.translate(-cam.px, -cam.py);
    const T = state === 'form' ? 0 : (performance.now() - tTap) / 1000;
    glow(W / 2, fy(520), FH * s * .55, 'rgba(20,110,150,.18)');
    if (ready) {
      const flick = reduce ? 1 : .96 + R() * .04;
      const done = state === 'done' || state === 'topic';
      const aSide = state === 'form' ? .95 * flick : done ? 0 : (1 - clamp((T - .55) / .45)) * .95;
      worldA += (worldAT - worldA) * .06;
      const aFront = (state === 'form' ? 0 : done ? flick : clamp((T - 1.9) / .8) * flick) * worldA;
      const aMorph = state !== 'fly' ? 0 : clamp((T - .45) / .25) * (1 - clamp((T - 2.1) / .7));
      drawImg(imgSide, SIDE, aSide); drawEdges(EP.side, aSide);
      drawImg(imgFront, FRONT, aFront); drawEdges(EP.front, aFront);
      if (aMorph > 0) {
        const sz = W < 600 ? 1.6 : 2;
        for (let b = 0; b < 6; b++) {
          const lv = b / 5;
          x.fillStyle = `rgb(${40 + lv * 190 | 0},${110 + lv * 140 | 0},${170 + lv * 85 | 0})`;
          for (let i = b; i < MP.length; i += 6) {
            const p = MP[i], kk = ease(clamp((T - .7 - p.d) / 1.25)), sw = Math.sin(kk * Math.PI);
            const px = p.sx + (p.dx - p.sx) * kk + sw * p.w, py = p.sy + (p.dy - p.sy) * kk - sw * 30;
            x.globalAlpha = aMorph * (.55 + .45 * (p.sl * (1 - kk) + p.dl * kk));
            x.fillRect(fx(px), fy(py), sz, sz);
          }
        }
        x.globalAlpha = 1;
      }
    }
    const cx = fx(CHEST.x), cy = fy(CHEST.y);
    if (pulse > .01) { x.globalCompositeOperation = 'lighter'; glow(cx, cy, 30 + pulse * 70, `rgba(94,240,255,${Math.min(.45, pulse * .4)})`); x.globalCompositeOperation = 'source-over'; pulse *= .965; }
    for (const r of rings) { r.r += r.v; r.a *= .955; x.strokeStyle = `rgba(94,240,255,${r.a})`; x.lineWidth = 1.1; x.beginPath(); x.ellipse(cx, cy, r.r, r.r * .5, 0, 0, 7); x.stroke(); }
    rings = rings.filter(r => r.a > .02);
    // time rush on the watch dial (Lebenslauf): hands race around, years fly by
    if (watchA > .01) {
      const wx = fx(WATCH.x), wy = fy(WATCH.y), wr = WATCH.r * s, el = (performance.now() - watchT0) / 1000;
      const sp = reduce ? 0 : el * el * 9, a = watchA * worldA;
      x.save(); x.globalCompositeOperation = 'lighter';
      glow(wx, wy, wr * 1.6, `rgba(94,240,255,${.25 * a})`);
      x.strokeStyle = `rgba(94,240,255,${.8 * a})`; x.lineWidth = wr * .035;
      x.beginPath(); x.arc(wx, wy, wr * 1.04, 0, 7); x.stroke();
      for (let i = 0; i < 60; i++) {
        const an = i / 60 * Math.PI * 2, l = i % 5 ? .06 : .14;
        x.globalAlpha = (i % 5 ? .35 : .9) * a;
        x.beginPath(); x.moveTo(wx + Math.cos(an) * wr * .97, wy + Math.sin(an) * wr * .97); x.lineTo(wx + Math.cos(an) * wr * (.97 - l), wy + Math.sin(an) * wr * (.97 - l)); x.stroke();
      }
      x.globalAlpha = a; x.lineCap = 'round';
      const hand = (ang, len, w, col) => { x.strokeStyle = col; x.lineWidth = wr * w; x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + Math.sin(ang) * wr * len, wy - Math.cos(ang) * wr * len); x.stroke(); };
      hand(sp * .08, .5, .07, 'rgba(234,252,255,.95)');
      hand(sp, .78, .045, 'rgba(94,240,255,1)');
      hand(sp * 4, .86, .02, 'rgba(255,255,255,.9)');
      x.fillStyle = '#eafcff'; x.beginPath(); x.arc(wx, wy, wr * .05, 0, 7); x.fill();
      x.restore();
    }
    x.restore();

    // screen layer: text particles
    const ps = W < 600 ? 1.7 : 2.2;
    if (state === 'form') {
      glow(W / 2, textY, TP.fs * 3, 'rgba(3,6,10,.55)');
      for (const p of TP) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dd = dx * dx + dy * dy;
        if (dd < 8000) { const f = (8000 - dd) / 8000 * 2.6, an = Math.atan2(dy, dx); p.vx += Math.cos(an) * f; p.vy += Math.sin(an) * f; }
        p.vx += (p.tx - p.x) * .03; p.vy += (p.ty - p.y + (reduce ? 0 : Math.sin(t * .03 + p.tx * .02) * 1.1)) * .03;
        p.vx *= .8; p.vy *= .8; p.x += p.vx; p.y += p.vy;
        const b = .6 + .4 * Math.sin(t * .05 + p.c * 6);
        x.fillStyle = p.c < .15 ? `rgba(255,255,255,${b})` : `rgba(94,240,255,${.65 + b * .35})`; x.fillRect(p.x, p.y, ps, ps);
      }
    } else if (state === 'fly') {
      for (const p of TP) {
        if (p.gone) continue;
        const kk = clamp((T - p.dl) / 1.05);
        if (kk >= 1) { p.gone = true; pulse = Math.min(1.4, pulse + .01); if (R() < .008) rings.push({ r: 8, v: 2, a: .6 }); continue; }
        const e = ease(kk), c1x = (p.x + cx) / 2 + (p.x - W / 2) * .5, c1y = Math.min(p.y, cy) - 60;
        const qx = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * c1x + e * e * cx, qy = (1 - e) * (1 - e) * p.y + 2 * (1 - e) * e * c1y + e * e * cy;
        x.fillStyle = `rgba(${200 + 55 * e | 0},250,255,${1 - e * .3})`; x.fillRect(qx, qy, ps * (1 - e * .6), ps * (1 - e * .6));
      }
      if (T > 2.9) { state = 'done'; rings.push({ r: 10, v: 2.6, a: .7 }); showMain(); }
    }
    requestAnimationFrame(frame);
  }

  // ---- UI ----
  function scramble(el) {
    const txt = el.dataset.t || (el.dataset.t = el.textContent), ch = '#%&@$*+<>/01';
    let k = 0; clearInterval(el._iv);
    el._iv = setInterval(() => {
      el.textContent = txt.split('').map((c2, i) => c2 === ' ' ? ' ' : i < k ? c2 : ch[R() * ch.length | 0]).join('');
      k += .5; if (k > txt.length) { el.textContent = txt; clearInterval(el._iv); }
    }, 40);
  }
  function showMain() {
    $('main').classList.add('on'); $('main').classList.remove('away');
    $('st').textContent = L().ui.me; $('langsw').classList.add('on'); scramble($('name'));
    $('menu').classList.add('on'); $('menu').classList.remove('hide');
  }
  function placeMenu() {
    const m = $('menu').style;
    if (W >= 760) { m.left = Math.min(W - 200, fx(880) + 20) + 'px'; m.right = 'auto'; m.top = fy(560) + 'px'; }
    else { m.left = 'auto'; m.right = '12px'; m.top = Math.round(H * .34) + 'px'; }
  }
  function go() {
    if (state !== 'form' || !ready) return;
    state = 'fly'; tTap = performance.now();
    $('hint').classList.add('off'); $('st').textContent = L().ui.transfer; $('startlang').classList.add('off');
  }
  function reset() {
    state = 'form'; pulse = 0; camRest(); closeTopics();
    for (const p of TP) { p.gone = false; p.x = fx(CHEST.x) + (R() - .5) * 20; p.y = fy(CHEST.y) + (R() - .5) * 20; p.vx = (R() - .5) * 30; p.vy = (R() - .5) * 30; }
    $('main').classList.remove('on'); $('menu').classList.remove('on');
    $('hint').classList.remove('off'); $('st').textContent = L().ui.ready; $('startlang').classList.remove('off'); $('langsw').classList.remove('on');
  }
  function toast(msg) { const tt = $('toast'); tt.textContent = msg; tt.classList.add('on'); clearTimeout(tt._t); tt._t = setTimeout(() => tt.classList.remove('on'), 1600); }

  // ---- topics ----
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function openTopic(name) {
    if (state !== 'done') return;
    const el = $('topic-' + name);
    if (!el) return;
    state = 'topic'; clearTimers();
    $('main').classList.add('away'); $('menu').classList.add('hide');
    if (name === 'sprachen') {
      $('st').textContent = L().topics.sprachen;
      // camera moves towards the face
      Object.assign(camT, { z: W < 600 ? 2.5 : 2.4, px: fx(FACE.x), py: fy(FACE.y), ax: W / 2, ay: H * .3 });
      later(() => { show(el); typeLangs(); }, 800);
    } else if (name === 'skills') {
      $('st').textContent = L().topics.skills;
      // camera glides to the arm with the watch
      Object.assign(camT, { z: W < 600 ? 1.9 : 1.8, px: fx(ARM.x), py: fy(ARM.y), ax: W * .5, ay: H * .22 });
      later(() => { show(el); buildSkills(); }, 750);
    } else if (name === 'ausbildung') {
      $('st').textContent = L().topics.ausbildung;
      // camera rises to the forehead – the knowledge
      Object.assign(camT, { z: W < 600 ? 2.3 : 2.2, px: fx(BROW.x), py: fy(BROW.y), ax: W / 2, ay: H * .22 });
      later(() => show(el), 750);
    } else if (name === 'lebenslauf') {
      $('st').textContent = L().topics.lebenslauf;
      // the camera dives into the watch – time races – then the desk globe takes over
      Object.assign(camT, { z: W < 600 ? 7.5 : 6.5, px: fx(WATCH.x), py: fy(WATCH.y), ax: W / 2, ay: H * .45 });
      watchA = 1; watchT0 = performance.now();
      later(() => { worldAT = 0; globeOn(true); }, reduce ? 300 : 1900);
      later(() => { show(el); buildStops(); }, reduce ? 500 : 2500);
    } else {
      $('st').textContent = L().topics.projekte;
      // camera dives into the eye, then the eye scene takes over
      Object.assign(camT, { z: 7, px: fx(EYE.x), py: fy(EYE.y), ax: W / 2, ay: H * .3 });
      later(() => { eyeOn(true); }, 650);
      later(() => { show(el); buildTimeline(); }, 1500);
    }
  }
  function show(el) { el.classList.add('on'); el.setAttribute('aria-hidden', 'false'); }
  function closeTopics() {
    clearTimers(); eyeOn(false); globeOn(false); worldAT = 1; watchA = 0;
    document.querySelectorAll('.topic').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); });
    $('pcard').hidden = true;
  }

  // typewriter
  function typeLangs() {
    const items = [...document.querySelectorAll('#langlist li')];
    items.forEach((li, i) => { li.textContent = ''; li.dataset.n = '0' + (i + 1); li.dataset.text = L().langs[i][0]; li.dataset.level = L().langs[i][1]; li.classList.remove('cur'); });
    let i = 0;
    const next = () => {
      if (i >= items.length || state !== 'topic') return;
      const li = items[i], txt = li.dataset.text; let k = 0;
      const word = document.createElement('span'), lv = document.createElement('span');
      lv.className = 'lv'; lv.textContent = li.dataset.level || '';
      li.append(word, lv); li.classList.add('cur');
      const tick = () => {
        if (state !== 'topic') return;
        word.textContent = txt.slice(0, ++k);
        if (k < txt.length) later(tick, 70 + R() * 70);
        else later(() => { li.classList.remove('cur'); lv.classList.add('in'); i++; next(); }, 350);
      };
      later(tick, 200);
    };
    next();
  }

  // project timeline
  function buildTimeline() {
    const ol = $('timeline'); ol.innerHTML = '';
    PROJECTS.forEach((p, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-expanded', 'false');
      b.innerHTML = `<span class="yr">${p.y}</span><span class="ti">${p.t}</span>`;
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') === 'true';
        ol.querySelectorAll('button').forEach(o => o.setAttribute('aria-expanded', 'false'));
        const card = $('pcard');
        if (open) { card.hidden = true; return; }
        b.setAttribute('aria-expanded', 'true');
        $('pk').textContent = `${p.y} · ${p.k}`; $('pt').textContent = p.t; $('pd').textContent = p.d; card.hidden = false;
      });
      li.appendChild(b); ol.appendChild(li);
      later(() => li.classList.add('in'), 150 + i * 220);
    });
  }

  // skills
  function buildSkills() {
    const st = $('stats'), sk = $('skills'); st.innerHTML = ''; sk.innerHTML = '';
    STATS.forEach(([v, l], i) => {
      const d = document.createElement('div'); d.className = 'stat'; d.innerHTML = `<b>${v}</b><span>${l}</span>`;
      st.appendChild(d); later(() => d.classList.add('in'), 100 + i * 150);
    });
    let n = 0;
    SKILLS.forEach(g => {
      const box = document.createElement('div'); box.className = 'sgroup';
      box.innerHTML = `<h4>${g.h}</h4>`; const ch = document.createElement('div'); ch.className = 'chips';
      g.c.forEach(c2 => {
        const e = document.createElement('span'); e.className = 'chip2' + (g.ai ? ' ai' : ''); e.textContent = c2;
        ch.appendChild(e); later(() => e.classList.add('in'), 500 + (n++) * 45);
      });
      box.appendChild(ch); sk.appendChild(box);
    });
  }

  // ---- desk globe (Lebenslauf) ----
  const gc = $('globe'), gx = gc.getContext('2d');
  let globeActive = false, globeRaf = 0, LAND = null, rot = { lon: 0, lat: 20 }, rotT = { lon: 0, lat: 20 }, stIdx = 0, auto = 0, gT0 = 0;
  fetch('land.json').then(r => r.json()).then(a => {
    LAND = [];
    for (let i = 0; i < a.length; i += 3) {
      const la = a[i] * Math.PI / 180, lo = a[i + 1] * Math.PI / 180;
      LAND.push([Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), a[i + 2]]);
    }
  }).catch(() => { LAND = []; });
  const v3 = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
  function proj(p, gcx, gcy, r) {
    const l = -rot.lon * Math.PI / 180, b = rot.lat * Math.PI / 180;
    const x1 = p[0] * Math.cos(l) + p[2] * Math.sin(l), z1 = -p[0] * Math.sin(l) + p[2] * Math.cos(l);
    const y2 = p[1] * Math.cos(b) - z1 * Math.sin(b), z2 = p[1] * Math.sin(b) + z1 * Math.cos(b);
    return [gcx + x1 * r, gcy - y2 * r, z2];
  }
  function globeOn(on) {
    if (on === globeActive) return;
    globeActive = on; gc.classList.toggle('on', on);
    if (on) {
      gc.width = W * D; gc.height = H * D; gx.setTransform(D, 0, 0, D, 0, 0);
      rot = { lon: 20, lat: 25 }; gT0 = performance.now(); cancelAnimationFrame(globeRaf); globeLoop();
    } else { clearInterval(auto); setTimeout(() => { if (!globeActive) cancelAnimationFrame(globeRaf); }, 1100); }
  }
  // shared geometry: year column on the left, globe in the middle, info card in its lower half
  function gGeom() {
    const mob = W < 600, colW = mob ? 74 : Math.min(190, W * .16), top = mob ? 92 : 100, bot = mob ? 78 : 90;
    // on phones the globe may tuck slightly under the year column so it can be bigger
    const availW = mob ? W - colW * .6 - 8 : W - colW * 2 - 16, availH = H - top - bot;
    const r = Math.max(90, Math.min(availW / 2 / 1.12, availH / 2.62, 300));
    const gcx = mob ? W - 6 - 1.12 * r : W / 2;
    const gcy = top + (availH - 2.62 * r) / 2 + 1.14 * r;
    return { r, gcx, gcy, colW, mob };
  }
  function placeGlobeUI() {
    const g = gGeom(), sb = $('stops'), sc = $('station'), kk = document.querySelector('#topic-lebenslauf .kicker');
    sb.style.left = (g.mob ? 14 : Math.max(22, g.gcx - g.r * 1.14 - g.colW)) + 'px';
    sb.style.top = Math.max(84, g.gcy - sb.offsetHeight / 2) + 'px';
    kk.style.left = sb.style.left; kk.style.top = (parseFloat(sb.style.top) - 26) + 'px';
    const cw = Math.min(g.r * (g.mob ? 1.8 : 1.72), 380);
    sc.style.width = cw + 'px'; sc.style.left = (g.gcx - cw / 2) + 'px'; sc.style.top = (g.gcy + g.r * .1) + 'px';
  }
  function centreOf(st) { let la = 0, lo = 0; st.p.forEach(q => { la += q[0]; lo += q[1]; }); return { lat: la / st.p.length, lon: lo / st.p.length }; }
  function selectStation(i, user) {
    stIdx = i; const st = STATIONS[i], c0 = centreOf(st);
    rotT = { lat: clamp(c0.lat - 27, -15, 40), lon: c0.lon };
    const sc = $('station'); sc.classList.remove('in'); void sc.offsetWidth; sc.classList.add('in');
    $('sy').textContent = st.y; $('sn').textContent = st.n; $('sd').textContent = st.d;
    document.querySelectorAll('#stops button').forEach((b, k) => b.setAttribute('aria-selected', k === i ? 'true' : 'false'));
    if (user) clearInterval(auto);
  }
  function buildStops() {
    const box = $('stops'); box.innerHTML = '';
    STATIONS.forEach((st, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = st.y.split(/[–\s]/)[0]; b.title = st.n;
      b.addEventListener('click', () => selectStation(i, true)); box.appendChild(b);
    });
    placeGlobeUI(); selectStation(0); clearInterval(auto);
    if (!reduce) auto = setInterval(() => { if (state === 'topic' && globeActive) selectStation((stIdx + 1) % STATIONS.length); }, 4200);
  }
  function globeLoop() {
    const tt = (performance.now() - gT0) / 1000;
    let dl = ((rotT.lon - rot.lon + 540) % 360) - 180;
    rot.lon += dl * .05; rot.lat += (rotT.lat - rot.lat) * .05;
    const G = gGeom(), r = G.r * (.8 + .2 * ease(clamp(tt / 1))), gcx = G.gcx, gcy = G.gcy;
    gx.clearRect(0, 0, W, H);
    // stand of the desk globe
    gx.strokeStyle = 'rgba(94,240,255,.35)'; gx.lineWidth = 1.2;
    gx.beginPath(); gx.moveTo(gcx, gcy + r * 1.12); gx.lineTo(gcx, gcy + r * 1.36); gx.stroke();
    gx.beginPath(); gx.ellipse(gcx, gcy + r * 1.4, r * .5, r * .09, 0, 0, 7); gx.stroke();
    gx.fillStyle = 'rgba(94,240,255,.06)'; gx.fill();
    // sphere
    const sg = gx.createRadialGradient(gcx - r * .3, gcy - r * .35, r * .1, gcx, gcy, r);
    sg.addColorStop(0, 'rgba(40,120,150,.35)'); sg.addColorStop(1, 'rgba(4,20,30,.55)');
    gx.fillStyle = sg; gx.beginPath(); gx.arc(gcx, gcy, r, 0, 7); gx.fill();
    gx.strokeStyle = 'rgba(94,240,255,.55)'; gx.lineWidth = 1; gx.stroke();
    // meridian ring (tilted, like a desk globe)
    gx.save(); gx.translate(gcx, gcy); gx.rotate(-.41);
    gx.strokeStyle = 'rgba(94,240,255,.45)'; gx.lineWidth = 2;
    gx.beginPath(); gx.ellipse(0, 0, r * 1.1, r * 1.1, 0, Math.PI * .55, Math.PI * 2.45); gx.stroke();
    gx.restore();
    // graticule
    gx.strokeStyle = 'rgba(94,240,255,.10)'; gx.lineWidth = .7;
    for (let la = -60; la <= 60; la += 30) { gx.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 6) { const q = proj(v3(la, lo), gcx, gcy, r); if (q[2] > 0) { pen ? gx.lineTo(q[0], q[1]) : gx.moveTo(q[0], q[1]); pen = true; } else pen = false; } gx.stroke(); }
    for (let lo = -180; lo < 180; lo += 30) { gx.beginPath(); let pen = false; for (let la = -80; la <= 80; la += 5) { const q = proj(v3(la, lo), gcx, gcy, r); if (q[2] > 0) { pen ? gx.lineTo(q[0], q[1]) : gx.moveTo(q[0], q[1]); pen = true; } else pen = false; } gx.stroke(); }
    // land dots
    if (LAND) {
      const sz = W < 600 ? 1.5 : 1.8;
      for (const p of LAND) {
        const q = proj(p, gcx, gcy, r); if (q[2] <= 0) continue;
        const a = .25 + .75 * q[2];
        gx.fillStyle = p[3] ? `rgba(94,240,255,${a})` : `rgba(150,200,215,${a * .45})`;
        gx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
      }
    }
    // route between stations
    gx.strokeStyle = 'rgba(255,255,255,.35)'; gx.lineWidth = 1; gx.setLineDash([3, 4]);
    for (let i = 1; i < STATIONS.length; i++) {
      const a = STATIONS[i - 1].p[0], b = STATIONS[i].p[0], va = v3(a[0], a[1]), vb = v3(b[0], b[1]);
      gx.beginPath(); let pen = false;
      for (let k = 0; k <= 24; k++) {
        const f = k / 24, m = [va[0] * (1 - f) + vb[0] * f, va[1] * (1 - f) + vb[1] * f, va[2] * (1 - f) + vb[2] * f];
        const L = Math.hypot(...m) || 1, lift = 1 + .06 * Math.sin(f * Math.PI), q = proj([m[0] / L * lift, m[1] / L * lift, m[2] / L * lift], gcx, gcy, r);
        if (q[2] > 0) { pen ? gx.lineTo(q[0], q[1]) : gx.moveTo(q[0], q[1]); pen = true; } else pen = false;
      }
      gx.stroke();
    }
    gx.setLineDash([]);
    // station markers
    STATIONS.forEach((st, i) => st.p.forEach(pp => {
      const q = proj(v3(pp[0], pp[1]), gcx, gcy, r); if (q[2] <= 0) return;
      const on = i === stIdx, pr = on ? 4 + 2 * Math.sin(tt * 4) : 2.5;
      gx.fillStyle = on ? '#fff' : 'rgba(94,240,255,.9)'; gx.beginPath(); gx.arc(q[0], q[1], pr * .7, 0, 7); gx.fill();
      if (on) {
        gx.strokeStyle = 'rgba(94,240,255,.8)'; gx.lineWidth = 1.2;
        gx.beginPath(); gx.arc(q[0], q[1], 9 + (tt * 14) % 14, 0, 7); gx.stroke();
      }
    }));
    globeRaf = requestAnimationFrame(globeLoop);
  }

  // eye scene (separate canvas): iris, pupil, fibres
  const ec = $('eye'), ex = ec.getContext('2d');
  let eyeActive = false, eyeT0 = 0, eyeRaf = 0, fibres = [];
  function eyeOn(on) {
    if (on === eyeActive) return;
    eyeActive = on; ec.classList.toggle('on', on);
    if (on) {
      ec.width = W * D; ec.height = H * D; ex.setTransform(D, 0, 0, D, 0, 0);
      fibres = Array.from({ length: W < 600 ? 900 : 1500 }, () => ({ a: R() * Math.PI * 2, r0: .26 + R() * .06, r1: .55 + R() * .45, w: R() * 1.2 + .2, c: R(), sp: (R() - .5) * .0006 }));
      eyeT0 = performance.now(); cancelAnimationFrame(eyeRaf); eyeLoop();
    } else setTimeout(() => { if (!eyeActive) cancelAnimationFrame(eyeRaf); }, 1100);
  }
  function eyeLoop() {
    const tt = (performance.now() - eyeT0) / 1000, cx = W / 2, cy = H * .3, Rr = Math.min(W, H) * (W < 600 ? .62 : .42);
    ex.fillStyle = '#02050a'; ex.fillRect(0, 0, W, H);
    const open = ease(clamp(tt / 1.2)), z = .85 + .15 * open;
    const g = ex.createRadialGradient(cx, cy, Rr * .2, cx, cy, Rr * 1.1);
    g.addColorStop(0, 'rgba(40,140,190,.35)'); g.addColorStop(.6, 'rgba(20,70,110,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ex.fillStyle = g; ex.fillRect(0, 0, W, H);
    ex.globalCompositeOperation = 'lighter';
    for (const f of fibres) {
      const a = f.a + tt * f.sp * 60, r0 = f.r0 * Rr * z, r1 = f.r1 * Rr * z;
      ex.strokeStyle = f.c < .7 ? `rgba(94,200,255,${.08 + f.c * .22})` : `rgba(200,240,255,${.12 + (f.c - .7) * .5})`;
      ex.lineWidth = f.w; ex.beginPath();
      ex.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ex.lineTo(cx + Math.cos(a + .02) * r1, cy + Math.sin(a + .02) * r1); ex.stroke();
    }
    ex.globalCompositeOperation = 'source-over';
    const pr = Rr * .27 * z * (1 + .03 * Math.sin(tt * 1.4));
    const pg = ex.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.15);
    pg.addColorStop(0, '#000'); pg.addColorStop(.8, 'rgba(0,6,12,.96)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ex.fillStyle = pg; ex.beginPath(); ex.arc(cx, cy, pr * 1.15, 0, 7); ex.fill();
    // highlight + thin rings
    ex.fillStyle = 'rgba(230,250,255,.55)'; ex.beginPath(); ex.ellipse(cx - pr * .45, cy - pr * .5, pr * .16, pr * .1, -.5, 0, 7); ex.fill();
    ex.strokeStyle = 'rgba(94,240,255,.35)'; ex.lineWidth = 1;
    ex.beginPath(); ex.arc(cx, cy, Rr * 1.02 * z, tt * .2, tt * .2 + 4.2); ex.stroke();
    ex.beginPath(); ex.arc(cx, cy, Rr * 1.1 * z, -tt * .15, -tt * .15 + 2.2); ex.stroke();
    const v = ex.createRadialGradient(cx, cy, Rr * .9, cx, cy, Math.max(W, H));
    v.addColorStop(0, 'rgba(2,5,10,0)'); v.addColorStop(1, 'rgba(2,5,10,1)'); ex.fillStyle = v; ex.fillRect(0, 0, W, H);
    eyeRaf = requestAnimationFrame(eyeLoop);
  }
  function back() {
    closeTopics(); camRest(); state = 'done';
    setTimeout(showMain, reduce ? 0 : 500);
  }

  // ---- language ----
  function renderEdu() {
    const e = L().edu; $('eduUni').textContent = e.uni; $('eduTitle').innerHTML = e.title;
    $('eduList').innerHTML = e.items.map(([y, tx]) => `<li><span class="mono">${y}</span>${tx}</li>`).join('');
  }
  function setLang(l, silent) {
    if (!LANGS.includes(l)) l = 'de';
    lang = l; loadContent();
    const d = L();
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = d.ui[el.dataset.i18n]; });
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = d.topics[el.dataset.t]; });
    document.querySelectorAll('[data-k]').forEach(el => { el.textContent = '// ' + d.topics[el.dataset.k]; });
    $('menu').setAttribute('aria-label', d.ui.menu);
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === l ? 'true' : 'false'));
    $('st').textContent = state === 'form' ? d.ui.ready : state === 'fly' ? d.ui.transfer : d.ui.me;
    renderEdu();
    try { localStorage.setItem('alexius-lang', l); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u); } catch (e) {}
    if (!silent && state === 'topic') { closeTopics(); camRest(); state = 'done'; showMain(); }
    else if (!silent && state === 'done') scramble($('name'));
  }
  document.querySelectorAll('#startlang [data-lang]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setLang(b.dataset.lang); go(); }));
  document.querySelectorAll('#langsw [data-lang]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setLang(b.dataset.lang); }));
  function placeStartLang() { $('startlang').style.top = Math.round(textY + TP.fs * .75) + 'px'; }

  // tapping alexius.ai always starts in German
  c.addEventListener('click', () => { if (state === 'form') { setLang('de', true); go(); } });
  $('again').addEventListener('click', e => { e.stopPropagation(); reset(); });
  document.querySelectorAll('.mbtn').forEach(b => b.addEventListener('click', () => openTopic(b.dataset.topic)));
  document.querySelectorAll('.topic .back').forEach(b => b.addEventListener('click', back));
  addEventListener('keydown', e => { if (e.key === 'Escape' && state === 'topic') back(); });
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  addEventListener('touchend', () => { mouse.x = mouse.y = -1e4; });
  // ignore small height-only changes (mobile browser toolbars)
  let rz; addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (Math.abs(innerWidth - W) < 2 && Math.abs(innerHeight - H) < 140) return;
      if (state === 'topic') { closeTopics(); state = 'done'; showMain(); }
      layout(); if (ready) buildParticles();
    }, 150);
  });

  const onload = () => { if (++loaded === 2) { buildParticles(); ready = true; } };
  imgSide.onload = imgFront.onload = onload;
  imgSide.src = 'side3.webp'; imgFront.src = 'front5.webp';
  let initial = 'de';
  try { initial = new URL(location.href).searchParams.get('lang') || localStorage.getItem('alexius-lang') || 'de'; } catch (e) {}
  layout(); setLang(initial, true); placeStartLang(); frame();
  addEventListener('resize', () => setTimeout(placeStartLang, 200));
})();
