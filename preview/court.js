// Moving background for the design preview: a padel court seen from behind one baseline, with a
// tennis-ball-lime ball rallying across the net. Drawn on a canvas behind the app.
// Light on the iPad: the court is drawn once per resize, the ball at about 30 frames a second, and it
// stops while the app is in the background. With "Reduce Motion" on, it shows one still frame.

(() => {
  const canvas = document.createElement("canvas");
  canvas.id = "court";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0, h = 0, dpr = 1, bg = null;

  // ---- Court geometry (metres): 10 wide (x from -5 to 5), 20 long (z from 0 near to 20 far) ----
  const D = 13;                       // camera distance behind the near baseline
  let nearY, horizonY, nearHalfW;
  const scaleAt = z => D / (D + z);
  const project = (x, z, y = 0) => {
    const s = scaleAt(z);
    const gy = horizonY + (nearY - horizonY) * s;
    const px = w / 2 + x * (nearHalfW / 5) * s;
    return { x: px, y: gy - y * (nearHalfW / 5) * s, s };
  };

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nearHalfW = Math.min(w * 0.46, h * 0.55);
    nearY = h * 1.02;
    horizonY = h * 0.08;
    drawBackground();
  }

  // The court, lights and glows, drawn once into an offscreen canvas.
  function drawBackground() {
    bg = document.createElement("canvas");
    bg.width = canvas.width; bg.height = canvas.height;
    const b = bg.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = b.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "#05080f"); base.addColorStop(1, "#0a1220");
    b.fillStyle = base; b.fillRect(0, 0, w, h);

    const glow = (x, y, r, rgb, a) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      b.fillStyle = g; b.fillRect(0, 0, w, h);
    };
    glow(w * 0.05, h * 0.95, Math.max(w, h) * 0.6, "240,122,44", 0.22);   // orange, bottom left
    glow(w * 0.95, h * 0.05, Math.max(w, h) * 0.5, "181,211,52", 0.10);   // lime, top right
    glow(w * 0.5, h * 0.55, Math.max(w, h) * 0.5, "35,58,85", 0.35);      // navy, centre

    // Court surface.
    const c = [project(-5, 0), project(5, 0), project(5, 20), project(-5, 20)];
    const surf = b.createLinearGradient(0, c[2].y, 0, c[0].y);
    surf.addColorStop(0, "rgba(35,58,85,0.10)"); surf.addColorStop(1, "rgba(35,58,85,0.32)");
    b.fillStyle = surf;
    b.beginPath(); c.forEach((p, i) => i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y)); b.closePath(); b.fill();

    // Lines.
    const line = (x1, z1, x2, z2, a = 0.09) => {
      const p = project(x1, z1), q = project(x2, z2);
      b.strokeStyle = `rgba(255,255,255,${a})`; b.lineWidth = 1.5;
      b.beginPath(); b.moveTo(p.x, p.y); b.lineTo(q.x, q.y); b.stroke();
    };
    line(-5, 0, 5, 0); line(-5, 20, 5, 20); line(-5, 0, -5, 20); line(5, 0, 5, 20);
    line(-5, 3.05, 5, 3.05); line(-5, 16.95, 5, 16.95); line(0, 3.05, 0, 16.95);

    // Glass back walls: faint vertical panels at the far end.
    for (let x = -5; x <= 5; x += 2.5) { const p = project(x, 20), q = project(x, 20, 3); b.strokeStyle = "rgba(255,255,255,0.04)"; b.beginPath(); b.moveTo(p.x, p.y); b.lineTo(q.x, q.y); b.stroke(); }
    const t1 = project(-5, 20, 3), t2 = project(5, 20, 3);
    b.strokeStyle = "rgba(255,255,255,0.05)"; b.beginPath(); b.moveTo(t1.x, t1.y); b.lineTo(t2.x, t2.y); b.stroke();

    // Net.
    const n1 = project(-5.4, 10), n2 = project(5.4, 10), n3 = project(5.4, 10, 0.88), n4 = project(-5.4, 10, 0.88);
    b.fillStyle = "rgba(255,255,255,0.05)";
    b.beginPath(); b.moveTo(n1.x, n1.y); b.lineTo(n2.x, n2.y); b.lineTo(n3.x, n3.y); b.lineTo(n4.x, n4.y); b.closePath(); b.fill();
    b.strokeStyle = "rgba(255,255,255,0.22)"; b.lineWidth = 2;
    b.beginPath(); b.moveTo(n4.x, n4.y); b.lineTo(n3.x, n3.y); b.stroke();
    b.lineWidth = 1; b.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 1; i < 12; i++) {
      const x = -5.4 + i * (10.8 / 12), p = project(x, 10), q = project(x, 10, 0.88);
      b.beginPath(); b.moveTo(p.x, p.y); b.lineTo(q.x, q.y); b.stroke();
    }
  }

  // ---- The rally ----
  const rand = (a, b) => a + Math.random() * (b - a);
  let shot = null, trail = [], ripples = [], side = 0;

  function newShot(from) {
    side = 1 - side;
    const toZ = side ? rand(13, 18.5) : rand(1.5, 7);          // landing point on the other half
    const to = { x: rand(-4, 4), z: toZ };
    const hitZ = side ? rand(18.5, 21) : rand(-1.5, 1);        // where the next player meets it
    const next = { x: Math.max(-4.5, Math.min(4.5, to.x + rand(-2, 2))), z: hitZ };
    shot = { from, to, next, t0: performance.now(), dur1: rand(1000, 1350), dur2: rand(420, 560), h1: rand(1.8, 3.4), h2: rand(0.6, 1.1), bounced: false };
  }

  function ballAt(now) {
    const s = shot, t = now - s.t0;
    if (t < s.dur1) {                                  // the shot over the net
      const k = t / s.dur1;
      return { x: s.from.x + (s.to.x - s.from.x) * k, z: s.from.z + (s.to.z - s.from.z) * k, y: 4 * s.h1 * k * (1 - k) + 0.9 * (1 - k) };
    }
    if (!s.bounced) { s.bounced = true; ripples.push({ x: s.to.x, z: s.to.z, t0: now }); }
    const k = Math.min(1, (t - s.dur1) / s.dur2);     // the short hop up to the next player
    if (k >= 1) { newShot({ x: s.next.x, z: s.next.z }); return ballAt(now); }
    return { x: s.to.x + (s.next.x - s.to.x) * k, z: s.to.z + (s.next.z - s.to.z) * k, y: 4 * s.h2 * k * (1 - k) + 0.9 * k * k };
  }

  function drawBall(b, now) {
    const g = project(b.x, b.z), p = project(b.x, b.z, b.y);
    const r = Math.max(3.5, 0.11 * (nearHalfW / 5) * g.s * 2.2);
    // shadow on the court
    ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0.2, 1 - b.y / 4)})`;
    ctx.beginPath(); ctx.ellipse(g.x, g.y, r * 1.3, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    // glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
    glow.addColorStop(0, "rgba(181,211,52,0.35)"); glow.addColorStop(1, "rgba(181,211,52,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill();
    // ball
    const body = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.2, p.x, p.y, r);
    body.addColorStop(0, "#ecf7a6"); body.addColorStop(0.55, "#c4dd45"); body.addColorStop(1, "#86a01e");
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    // seam, turning as it flies
    const spin = now / 180;
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath(); ctx.arc(p.x + Math.cos(spin) * r * 0.9, p.y + Math.sin(spin) * r * 0.9, r * 0.75, spin + 2.2, spin + 4.1); ctx.stroke();
  }

  function frame(now) {
    ctx.drawImage(bg, 0, 0, w, h);

    // ripples where the ball bounced
    ripples = ripples.filter(rp => now - rp.t0 < 900);
    for (const rp of ripples) {
      const k = (now - rp.t0) / 900, g = project(rp.x, rp.z);
      const rr = (8 + 50 * k) * g.s * 1.6;
      ctx.strokeStyle = `rgba(240,122,44,${0.55 * (1 - k)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, rr, rr * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const b = ballAt(now);
    trail.push(b); if (trail.length > 14) trail.shift();
    trail.forEach((t, i) => {
      const p = project(t.x, t.z, t.y), a = (i / trail.length) * 0.35;
      ctx.fillStyle = `rgba(181,211,52,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, 3 * p.s * 1.4) * (i / trail.length), 0, Math.PI * 2); ctx.fill();
    });
    drawBall(b, now);
  }

  let last = 0, running = false;
  function loop(now) {
    if (!running) return;
    if (now - last > 30) { last = now; frame(now); }
    requestAnimationFrame(loop);
  }
  function start() { if (running || still) return; running = true; requestAnimationFrame(loop); }
  function stop() { running = false; }

  layout();
  newShot({ x: rand(-3, 3), z: rand(-1, 1) });
  if (still) { shot.t0 = performance.now() - shot.dur1 * 0.45; frame(performance.now()); }
  else start();

  let resizeTimer = null;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); if (still) frame(performance.now()); }, 120); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
})();
