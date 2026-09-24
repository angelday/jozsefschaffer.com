// The start screen: part 1's starfield with the play prompt set in its credits font, using the part's own palette
// routines ($36606 scales colours 0-7 by step/16 every 4 fields, $3663A moves colours 8-15 one notch towards blue
// every 3 fields). The stars fade in, the prompt follows a second after they first change direction; pressing play
// wipes the prompt with the intertitle copper wave, holds a second, then fades the stars out. The screen is part 1's
// 352 x 272 display, which starts 8 lines above the part 9 screen.
window.PressPlay = function (data, flash) {
  const W = 352, H = 272, TOP = 8, WIPE = 70, HOLD = 50, STARS_OUT = 64;
  const stars = window.Part1Starfield(data);
  // the prompt starts fading in a second after the movement script first changes the stars' velocity
  let textStart = data.start.countdown;
  for (const e of data.script) { if (e.slice(1, 4).some((v, k) => v !== data.start.vel[k])) break; textStart += e[0]; }
  textStart += HOLD;

  // text bitplane, laid out like the credits ($35746): lines centred on x, 22 px pitch, the block centred on y
  const font = Uint8Array.from(atob(data.font), (c) => c.charCodeAt(0));
  const text = new Uint8Array(W * H);
  const adv = (ch) => data.glyphs[ch - 32][1];
  function blit(ch, x, y) {
    const off = data.glyphs[ch - 32][0];
    for (let r = 0; r < data.glyphRows; r++) for (let b = 0; b < 32; b++) {
      const sy = (off / 40 | 0) + r, sx = (off % 40) * 8 + b;
      if (!((font[sy * 40 + (sx >> 3)] >> (7 - (sx & 7))) & 1)) continue;
      const px = x + b, py = y + r;
      if (px >= 0 && px < W && py >= 0 && py < H) text[py * W + px] = 1;
    }
  }
  const lines = data.prompt.map((s) => Array.from(s, (c) => c.charCodeAt(0)));
  const [cx, cy] = data.center;
  let ty = cy - ((data.linePitch * (lines.length - 1) + data.lastLine) >> 1);
  for (const line of lines) {
    let x = cx - (line.reduce((s, c) => s + adv(c), 0) >> 1);
    for (const c of line) { blit(c, x, ty); x += adv(c); }
    ty += data.linePitch;
  }

  // palette state
  const comp = (c, k) => (c >> (4 * k)) & 15;
  const scaled = (c, s) => [0, 1, 2].reduce((v, k) => v | ((comp(c, k) * s) >> 4) << (4 * k), 0);
  const towards = (c, target) => [0, 1, 2].reduce((v, k) => {
    const a = comp(c, k), b = comp(target, k);
    return v | (a + Math.sign(b - a)) << (4 * k);
  }, 0);
  let field = 0, pressedAt = -1, wipe = 0, starStep = -1;     // starStep -1: the copper's initial black
  const textCols = data.copperInit.slice(8);
  const wave = new Int16Array(256);
  const textShown = () => field > textStart;

  function tick() {
    field++;
    stars.step();
    const since = pressedAt < 0 ? -1 : field - pressedAt;
    if (since < 0 || since <= wipe + HOLD) {
      if (field % 4 === 0 && field <= 64) starStep = field / 4 - 1;                 // 16 blocks of 4 fields
      const t = field - textStart;
      if (since < 0 && t > 0 && t % 3 === 0 && t <= 48) for (let i = 0; i < 8; i++) textCols[i] = towards(textCols[i], data.textTarget[i]);
    } else if ((since - wipe - HOLD) % 4 === 0 && starStep > 0) starStep--;         // the fade-in steps, backwards
  }

  return {
    tick,
    fullOutro: WIPE + HOLD + STARS_OUT,                      // fields from the press to the end of the start screen
    // returns how many fields the outro will take: a prompt that never appeared needs no wipe
    press() {
      if (pressedAt < 0) { pressedAt = field; wipe = textShown() ? WIPE : 0; }
      return wipe + HOLD + STARS_OUT;
    },
    get finished() { return pressedAt >= 0 && field - pressedAt >= wipe + HOLD + STARS_OUT; },
    // paint the screen into RGBA pixels of the 352-wide canvas (canvas row 0 is display line $2C)
    draw(pixels, width) {
      const starCols = data.greys.map((c) => (starStep < 0 ? 0 : scaled(c, starStep)));
      wave.fill(-1);
      if (pressedAt >= 0 && wipe) window.copperWave(flash, Math.min(field - pressedAt, WIPE), wave);
      const showText = pressedAt < 0 ? textShown() : wipe > 0;
      for (let yy = 0; yy < 256; yy++) {
        const row = (yy + TOP) * W;
        for (let x = 0; x < W; x++) {
          const s = stars.planes[row + x], t = showText && text[row + x];
          if (!s && !t) continue;
          const c = t ? (wave[yy] >= 0 ? wave[yy] : textCols[s]) : starCols[s];
          if (!c) continue;
          const k = (yy * width + x) * 4;
          pixels[k] = comp(c, 2) * 17; pixels[k + 1] = comp(c, 1) * 17; pixels[k + 2] = comp(c, 0) * 17;
        }
      }
    },
  };
};
