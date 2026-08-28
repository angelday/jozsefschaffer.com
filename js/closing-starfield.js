// Closing callout — 4×4 CGA hyperspace starfield that fires on callout hover.
// Stars zoom from a vanishing point outward; short trails give the
// "jumping to lightspeed" feel. Idle = intensity 0, no drawing.

export function initClosingStarfield() {
  const callout = document.querySelector(".closing-callout");
  if (!callout) return;
  const canvas = callout.querySelector("[data-starfield]");
  if (!canvas) return;

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  const STAR_COUNT = 240;
  const SPEED = 0.035;
  const JUMP_SPEED = 0.11;
  const JUMP_ACCEL = 0.0045;
  const Z_NEAR = 0.15;
  const Z_FAR = 1.5;

  // Pixel block size scales with callout width so mobile doesn't look chunky.
  let PIXEL = 4;

  let w = 0;
  let h = 0;
  let cx = 0;
  let cy = 0;
  let focal = 0;
  // Star (x, y) units match the "visible frustum at z=1" — i.e. x in
  // [-ratioX, ratioX] fills the canvas width exactly at z=1. Seeding in that
  // space keeps stars packed into the projected frustum instead of mostly
  // flying off the top/bottom of a wide-but-short callout.
  let ratioX = 0;
  let ratioY = 0;
  let stars = [];
  let hovering = false;
  let jumping = false;
  let jumpSpeed = SPEED;
  let lastFrameTime = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = callout.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    cx = w / 2;
    cy = h / 2;
    focal = Math.max(w, h) * 0.9;
    ratioX = w / (2 * focal);
    ratioY = h / (2 * focal);
    PIXEL = w >= 900 ? 4 : w >= 540 ? 3 : 2;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    seedStars();
  }

  function randomStar() {
    return {
      x: (Math.random() - 0.5) * 2 * ratioX,
      y: (Math.random() - 0.5) * 2 * ratioY,
      z: Z_NEAR + Math.random() * (Z_FAR - Z_NEAR),
      active: false,
    };
  }

  function seedStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) stars.push(randomStar());
  }

  // Stars spawn beyond Z_FAR so they approach the visible band one by one,
  // mirroring the exit drain. Staggered across [Z_FAR, 2*Z_FAR - Z_NEAR].
  function spawnDepth() {
    return Z_FAR + Math.random() * (Z_FAR - Z_NEAR);
  }

  function activateInactive() {
    for (const s of stars) {
      if (s.active) continue;
      s.x = (Math.random() - 0.5) * 2 * ratioX;
      s.y = (Math.random() - 0.5) * 2 * ratioY;
      s.z = spawnDepth();
      s.active = true;
    }
  }

  function step(now = 0) {
    requestAnimationFrame(step);
    const frameScale = lastFrameTime ? (now - lastFrameTime) / (1000 / 60) : 1;
    lastFrameTime = now;
    if (jumping) {
      jumpSpeed = Math.min(JUMP_SPEED, jumpSpeed + JUMP_ACCEL * frameScale);
    } else {
      jumpSpeed = SPEED;
    }

    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      if (!s.active) continue;
      const prevZ = s.z;
      s.z -= (jumping ? jumpSpeed : SPEED) * frameScale;

      if (s.z <= Z_NEAR) {
        if (hovering || jumping) {
          s.x = (Math.random() - 0.5) * 2 * ratioX;
          s.y = (Math.random() - 0.5) * 2 * ratioY;
          s.z = spawnDepth();
          continue;
        }
        // No hover → let stars run out to the near plane and vanish.
        s.active = false;
        continue;
      }

      // Not yet in the visible band — travel on in silence.
      if (s.z > Z_FAR) continue;

      const sx1 = (s.x / prevZ) * focal + cx;
      const sy1 = (s.y / prevZ) * focal + cy;
      const sx2 = (s.x / s.z) * focal + cx;
      const sy2 = (s.y / s.z) * focal + cy;

      const minX = Math.min(sx1, sx2);
      const maxX = Math.max(sx1, sx2);
      const minY = Math.min(sy1, sy2);
      const maxY = Math.max(sy1, sy2);
      if (maxX < 0 || minX > w || maxY < 0 || minY > h) continue;

      ctx.fillStyle = "#ffffff";

      const dx = sx2 - sx1;
      const dy = sy2 - sy1;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      const steps = Math.max(1, Math.ceil(len / PIXEL));

      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = sx1 + dx * t;
        const y = sy1 + dy * t;
        const px = Math.floor(x / PIXEL) * PIXEL;
        const py = Math.floor(y / PIXEL) * PIXEL;
        if (px < -PIXEL || py < -PIXEL || px >= w || py >= h) continue;
        ctx.fillRect(px, py, PIXEL, PIXEL);
      }
    }
  }

  callout.addEventListener("pointerenter", () => {
    hovering = true;
    activateInactive();
  });
  callout.addEventListener("pointerleave", () => {
    hovering = false;
  });
  callout.addEventListener("focus", () => {
    hovering = true;
    activateInactive();
  });
  callout.addEventListener("blur", () => {
    hovering = false;
  });
  callout.addEventListener("pc-sound-start", () => {
    jumping = true;
    jumpSpeed = SPEED;
    activateInactive();
  });
  callout.addEventListener("pc-sound-end", () => {
    jumping = false;
  });

  new ResizeObserver(resize).observe(callout);
  resize();
  seedStars();
  step();
}
