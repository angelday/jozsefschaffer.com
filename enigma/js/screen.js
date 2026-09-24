// The static parts of the Enigma part 9 screen: the PHENOMENA logo (with its fade) and the chrome scroller.
// Everything is drawn at native Amiga resolution (352 x 256 lowres pixels) and scaled up nearest-neighbour.
window.Part9Screen = function (data, canvas) {
  const W = data.screen.width, H = data.screen.height;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const rgb12 = (hex) => [parseInt(hex[0], 16), parseInt(hex[1], 16), parseInt(hex[2], 16)];

  // logo: 320x28, 16 colours; the fade multiplies each 4-bit gun by step/16 (step 0..16)
  const logo = decode(data.logo), logoPal = data.logoPalette.map(rgb12);
  const [LX, LY] = data.screen.logo;

  // scroller: 16x16 glyphs for ASCII 32..95 (one 16-bit word per row)
  const fontBytes = decode(data.font);
  const glyphRow = (ch, r) => { const i = ((ch - 32) * 16 + r) * 2; return (fontBytes[i] << 8) | fontBytes[i + 1]; };
  const grad = data.scrollerGradient.map(rgb12);
  const [SX, SY, SW, SH] = data.screen.scroller;
  const BUF = data.scrollerWrap;                          // 368 px ring buffer, stored twice for the wrap
  const buffer = new Uint8Array(BUF * 2 * 16);
  const text = data.scrollerText;
  const scroll = {};
  function reset() {                                      // the part's start state: empty buffer, text from the top
    buffer.fill(0);
    Object.assign(scroll, { pos: 0, speed: data.scrollerSpeedStart, target: data.scrollerSpeedTarget, word: 0, ptr: 0 });
  }
  reset();

  function nextChar() {
    if (text[scroll.ptr] === undefined || text[scroll.ptr] === 0) scroll.ptr = 0;
    let ch = text[scroll.ptr++];
    if (ch === 1) {                                       // $01 n: new target speed, then the next character
      scroll.target = (text[scroll.ptr] << 24) >> 24;
      ch = text[scroll.ptr + 1];
      scroll.ptr += 2;
    }
    return ch;
  }
  function drawGlyph(ch, x) {
    for (let r = 0; r < 16; r++) {
      const w = ch >= 32 && ch < 96 ? glyphRow(ch, r) : 0;
      for (let b = 0; b < 16; b++) {
        const v = (w >> (15 - b)) & 1;
        buffer[r * BUF * 2 + x + b] = v;
        buffer[r * BUF * 2 + x + b + BUF] = v;
      }
    }
  }
  // one field (1/49.92 s) of the original routine
  function stepScroller() {
    const speed = scroll.speed;
    if (scroll.speed < scroll.target) scroll.speed++;
    else if (scroll.speed > scroll.target) scroll.speed--;
    scroll.pos = (scroll.pos + speed) % BUF;
    const word = scroll.pos >> 4;
    if (word !== scroll.word) { scroll.word = word; drawGlyph(nextChar(), word * 16); }
  }

  let fade = 0;
  // paint(pixels, width) replaces the part's own layers, e.g. with the intertitle that precedes it
  function draw(paint) {
    const d = img.data;
    d.fill(0);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    if (paint) { paint(d, W); ctx.putImageData(img, 0, 0); return; }
    // logo
    const lp = logoPal.map((c) => c.map((v) => ((v * fade) >> 4) * 17));
    for (let y = 0; y < 28; y++) for (let x = 0; x < 320; x++) {
      const c = lp[logo[y * 320 + x]], k = ((LY + y) * W + LX + x) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
    }
    // scroller: visible window starts 17 px into the ring buffer past the scroll position
    const start = scroll.pos + 17;
    for (let r = 0; r < SH; r++) {
      const c = grad[r].map((v) => v * 17), row = r * BUF * 2;
      for (let x = 0; x < SW; x++) {
        if (!buffer[row + ((start + x) % (BUF * 2))]) continue;
        const k = ((SY + r) * W + SX + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  return {
    setFade(step) { fade = Math.max(0, Math.min(16, step)); },
    reset() { reset(); fade = 0; },
    stepScroller,
    draw,
  };
};
