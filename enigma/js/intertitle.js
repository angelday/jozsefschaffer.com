// The demo body's intertitle before part 9 ("MORE NEW THINGS....."), ported from the sequencer at $3CD4.
// One bitplane, 320 x 212, with COLOR01 set per scanline by the copper: a 15-step blue fade-in, a hold while
// the part loads from disk, then a copper wave (blue -> white -> red -> black) that climbs the screen in 9-line bands.
// The copper wave that wipes an intertitle ($4160): 23 bands of 9 lines climb from the bottom, each band stepping
// through the flash table (blue, white, red, black) one entry per field. At iteration t it writes the colour of
// display lines 0..211 (counted from line $2C) into out; lines no band has reached are left as they were.
window.copperWave = function (flash, t, out) {
  for (let b = 0; b < 23 && b < t; b++) {
    const c = Math.min(t, b + 47) - b;                    // last table position this band was written from
    for (let j = 0; j < 9; j++) out[203 - 9 * b + j] = flash[c + j];
  }
  return out;
};

window.Intertitle = function (data) {
  const W = 320, H = 212;
  const font = Uint8Array.from(atob(data.font), (c) => c.charCodeAt(0));   // 320 x 180, 1 bit per pixel
  const plane = new Uint8Array(W * H);
  const adv = (ch) => data.glyphs[ch - 32][1];

  // OR one 32 x 20 font cell into the bitplane at (x, y), like the blitter's A|C cookie-cut
  function blit(ch, x, y) {
    const off = data.glyphs[ch - 32][0];
    for (let r = 0; r < 20; r++) for (let b = 0; b < 32; b++) {
      const sy = (off / 40 | 0) + r, sx = (off % 40) * 8 + b;
      if (!((font[sy * 40 + (sx >> 3)] >> (7 - (sx & 7))) & 1)) continue;
      const px = x + b, py = y + r;
      if (px >= 0 && px < W && py >= 0 && py < H) plane[py * W + px] = 1;
    }
  }
  // layout pass as in $3E18: every line centred on cx, 27 px line pitch, the block centred on cy
  const lines = data.lines.map((s) => Array.from(s, (c) => c.charCodeAt(0)));
  const [cx, cy] = data.center;
  let y = cy - ((27 * (lines.length - 1) + 25) >> 1);
  for (const line of lines) {
    let x = cx - (line.reduce((s, c) => s + adv(c), 0) >> 1);
    for (const c of line) { blit(c, x, y); x += adv(c); }
    y += 27;
  }

  // COLOR01 of every scanline at intertitle tick p (PAL fields, 0 = screen drawn, still black)
  const colours = new Uint16Array(H);
  function lineColours(p) {
    const T = data.timing;
    if (p < T.flashStart) {
      const k = Math.min(15, Math.floor(p / T.fadeStep));
      return colours.fill(k ? data.fade[k - 1] : 0);
    }
    return window.copperWave(data.flash, p - T.flashStart + 1, colours.fill(0x00f));
  }

  return {
    length: data.timing.partStart,
    // paint the text screen for tick p into RGBA pixels of a canvas `width` wide, at (ox, oy)
    draw(pixels, width, ox, oy, p) {
      const col = lineColours(p);
      for (let yy = 0; yy < H; yy++) {
        const c = col[yy], r = ((c >> 8) & 15) * 17, g = ((c >> 4) & 15) * 17, bl = (c & 15) * 17;
        if (!c) continue;
        for (let x = 0; x < W; x++) {
          if (!plane[yy * W + x]) continue;
          const k = ((oy + yy) * width + ox + x) * 4;
          pixels[k] = r; pixels[k + 1] = g; pixels[k + 2] = bl;
        }
      }
    },
  };
};
