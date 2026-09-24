// The 3D starfield from Enigma part 1, ported instruction for instruction (code at $35B04 and $35B6E).
// 120 stars live on a byte grid (-128..127 per axis, wrapping). Every field a movement script adds a velocity and
// spins three angles; the rotation matrix and every star are multiplied through a 256x256 table of (a*b)>>7 bytes
// that the code patches into its own instructions, then projected with 200/(z+200). All of that is integer maths
// with truncation, so the stars shiver a little from frame to frame, exactly like on the Amiga.
window.Part1Starfield = function (data) {
  const W = 352, H = 272, STARS = 120, DEPTH = 200, CX = 176, CY = 136;

  // mul table at $6211A: byte (a*b) >>> 7 for a, b in -128..127; T(a, b) reads it centred like (a3,d.w)
  const table = new Int8Array(65536);
  for (let a = -128; a < 128; a++) for (let b = -128; b < 128; b++) table[(a + 128) * 256 + b + 128] = (((a * b) & 0xffff) >>> 7) & 0xff;
  const word = (v) => ((v & 0xffff) ^ 0x8000) - 0x8000;
  const byte = (v) => ((v & 0xff) ^ 0x80) - 0x80;
  const at = (offset) => table[(0x8080 + word(offset)) & 0xffff];          // move.b (a3, d.w) with a word offset
  const T = (row, col) => at(((row & 0xff) << 8) + col);                    // lsl.w #8 then add.w: row*col/128

  // 64-bit random generator at $365A4: x = x' * 131075 with the low byte forced to %0010xxx0 first
  let state = 0n;
  const M64 = (1n << 64n) - 1n;
  function next() {
    let lo = state & 0xffffffffn;
    lo = (lo & ~0xffn) | ((lo & 0x0en) | 0x20n);
    const x = ((state >> 32n) << 32n) | lo;
    state = (x * 3n + ((x * 2n) << 16n)) & M64;
    return Number(state >> 32n);
  }
  const random = (n) => (next() >>> 16) % n;                                // high word of the upper long, divu

  // seed as the part does: d1 holds 271*44 from the line table loop when $24334321 is added
  state = (BigInt((0x24334321 + 271 * 44) >>> 0) << 32n) | 0x24334321n;
  next();
  const stars = new Int16Array(STARS * 3);                                  // coordinate words, low byte always 0
  for (let i = 0; i < STARS * 3; i++) stars[i] = word((random(256) - 128) << 8);

  const sin = data.sine;                                                    // floor(127 sin deg), 0..449
  const s = { countdown: data.start.countdown, vel: [...data.start.vel], spin: [...data.start.spin], angle: [0, 0, 0], next: 0 };
  const m = new Int16Array(9);
  const planes = new Uint8Array(W * H);                                     // 3 star bitplanes as a colour index 0..7

  function step() {
    // movement script ($35B6E): a new velocity and spin when the countdown runs out; loops at the end
    if (--s.countdown <= 0) {
      if (s.next >= data.script.length) s.next = 0;
      const e = data.script[s.next++];
      s.countdown = e[0]; s.vel = e.slice(1, 4); s.spin = e.slice(4, 7);
    }
    for (let k = 0; k < 3; k++) {
      let a = s.angle[k] + s.spin[k];
      if (a < 0) a += 360;
      if (a >= 360) a -= 360;
      s.angle[k] = a;
    }
    const [A, B, C] = s.angle;
    const ca = sin[A + 90], sa = sin[A], cb = sin[B + 90], sb = sin[B], cc = sin[C + 90], sc = sin[C];
    // rotation matrix, in the order the code builds it
    m[7] = sa; const nsa = word(-sa);
    m[0] = cb; m[1] = 0; m[4] = ca;
    m[3] = T(nsa, sb); m[6] = T(ca, sb); m[2] = word(-sb);
    m[5] = T(nsa, cb); m[8] = T(ca, cb);
    m[0] = T(cc, cb);
    m[1] = word(Math.floor(-(sc * cb) / 128));
    const m3 = word(T(cc, m[3]) + T(sc, ca)), m4 = word(T(cc, ca) - T(sc, m[3]));
    const m6 = word(T(cc, m[6]) + T(sc, m[7])), m7 = word(T(cc, m[7]) - T(sc, m[6]));
    m[3] = m3; m[4] = m4; m[6] = m6; m[7] = m7;
    const d = Array.from(m, byte);                                          // only the low bytes are patched in

    planes.fill(0);
    const [vx, vy, vz] = s.vel.map((v) => word(v << 8));
    for (let i = 0; i < STARS * 3; i += 3) {
      const x = stars[i], y = stars[i + 1], z = stars[i + 2];
      stars[i] = word(x + vx); stars[i + 1] = word(y + vy); stars[i + 2] = word(z + vz);
      let px = at(x + d[0]) + at(y + d[1]) + at(z + d[2]);
      let py = at(x + d[3]) + at(y + d[4]) + at(z + d[5]);
      let pz = word(at(x + d[6]) + at(y + d[7]) + at(z + d[8]) + DEPTH);
      if (pz !== 0) {                                                        // muls then divs; overflow leaves the product
        const qx = Math.trunc((px * DEPTH) / pz), qy = Math.trunc((py * DEPTH) / pz);
        px = qx >= -32768 && qx <= 32767 ? qx : px * DEPTH;
        py = qy >= -32768 && qy <= 32767 ? qy : py * DEPTH;
      }
      const sx = word(px + CX), sy = word(py + CY);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const depth = pz - 64;
      if (depth > 255) continue;
      // brightness bits: a clear bit 5/6/7 of (z-64) sets bitplane 0/1/2, so near stars are brighter
      const c = (depth & 0x20 ? 0 : 1) | (depth & 0x40 ? 0 : 2) | (depth & 0x80 ? 0 : 4);
      planes[sy * W + sx] |= c;
    }
  }
  return { width: W, height: H, planes, step };
};
