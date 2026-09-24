const DEFAULT_IMAGE_PATH = "../img/hero-raster-reveal-cga.png";
const SOURCE_PIXEL_SCALE = 4;

const DEFAULTS = {
  sideMaskCount: 8,
  staggerFrames: 2,
  handoffLeadFrames: 54,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function createCanvasStrip(root, index) {
  const canvas = document.createElement("canvas");
  canvas.className = "hero__raster-strip";
  canvas.setAttribute("aria-label", `Hero raster reveal strip ${index + 1}`);
  root.append(canvas);

  return canvas;
}

function getTargetPixelScale(width) {
  if (width <= 520) return 2;
  if (width <= 820) return 3;
  return 4;
}

function snapUp(value, unit) {
  return Math.max(unit, Math.ceil(value / unit) * unit);
}

export async function initHeroRasterReveal({
  root = document.querySelector("[data-hero-raster-reveal]"),
  onHandoff,
  onComplete,
} = {}) {
  if (!(root instanceof HTMLElement)) {
    onComplete?.();
    return () => {};
  }

  const settings = { ...DEFAULTS };
  const maskCount = settings.sideMaskCount * 2;
  const imageSrc =
    root.dataset.rasterSrc ||
    new URL(DEFAULT_IMAGE_PATH, import.meta.url).toString();
  const image = await loadImage(imageSrc);
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;

  root.innerHTML = "";

  const strips = Array.from({ length: maskCount }, (_, index) => {
    const canvas = createCanvasStrip(root, index);
    const context = canvas.getContext("2d");
    const isMirror = index >= settings.sideMaskCount;
    const distanceFromCenter = isMirror
      ? index - settings.sideMaskCount
      : settings.sideMaskCount - index - 1;

    return { canvas, context, distanceFromCenter, isMirror };
  }).filter(({ context }) => context);

  if (strips.length === 0) {
    onComplete?.();
    return () => {};
  }

  let animationFrame = 0;
  let frame = 0;
  let didHandoff = false;
  let didComplete = false;
  let geometry = {
    width: 1,
    maskHeight: 16 * SOURCE_PIXEL_SCALE,
    drawWidth: imageWidth,
    drawHeight: imageHeight,
    scrollStep: 6,
    finalFrame: 1,
    handoffFrame: 0,
  };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const bounds = root.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.ceil(bounds.width || root.clientWidth || window.innerWidth)
    );
    const height = Math.max(
      1,
      bounds.height || root.clientHeight || window.innerHeight
    );
    const pixelScale = getTargetPixelScale(width);
    const drawScale = pixelScale / SOURCE_PIXEL_SCALE;
    const maskHeight = snapUp(height / maskCount, pixelScale);
    const scrollStep = Math.max(1, Math.round(pixelScale * 1.5));
    const drawHeight = imageHeight * drawScale;
    const scrollFrames = Math.ceil((maskHeight + drawHeight) / scrollStep);
    const finalFrame =
      scrollFrames + settings.staggerFrames * (settings.sideMaskCount - 1);

    geometry = {
      width,
      maskHeight,
      drawWidth: imageWidth * drawScale,
      drawHeight,
      scrollStep,
      finalFrame,
      handoffFrame: Math.max(0, finalFrame - settings.handoffLeadFrames),
    };

    root.style.setProperty("--hero-raster-strip-height", `${maskHeight}px`);

    strips.forEach(({ canvas, context }) => {
      canvas.width = Math.max(1, Math.ceil(width * ratio));
      canvas.height = Math.max(1, Math.ceil(maskHeight * ratio));
      canvas.style.height = `${maskHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
    });
  }

  function drawTiled(context, offsetY) {
    const width = geometry.width;
    const drawWidth = Math.max(1, geometry.drawWidth);

    for (let x = 0; x < width; x += drawWidth) {
      context.drawImage(
        image,
        x,
        offsetY,
        geometry.drawWidth,
        geometry.drawHeight
      );
    }
  }

  function renderStrip(strip) {
    const localFrame = frame - strip.distanceFromCenter * settings.staggerFrames;

    strip.context.clearRect(0, 0, geometry.width, geometry.maskHeight);

    if (localFrame < 0) {
      return;
    }

    const offsetY = geometry.maskHeight - localFrame * geometry.scrollStep;

    if (offsetY < -geometry.drawHeight) {
      return;
    }

    if (strip.isMirror) {
      strip.context.save();
      strip.context.translate(0, geometry.maskHeight);
      strip.context.scale(1, -1);
      drawTiled(strip.context, offsetY);
      strip.context.restore();
      return;
    }

    drawTiled(strip.context, offsetY);
  }

  function handoff() {
    if (didHandoff) return;
    didHandoff = true;
    onHandoff?.();
  }

  function finish() {
    if (didComplete) return;
    handoff();
    didComplete = true;
    onComplete?.();
  }

  function render() {
    strips.forEach(renderStrip);
    frame += 1;

    if (frame >= geometry.handoffFrame) {
      handoff();
    }

    if (frame <= geometry.finalFrame) {
      animationFrame = window.requestAnimationFrame(render);
    } else {
      finish();
    }
  }

  function cleanup() {
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", resize);
    resizeObserver?.disconnect();
    root.innerHTML = "";
  }

  const resizeObserver =
    "ResizeObserver" in window ? new ResizeObserver(resize) : null;

  window.addEventListener("resize", resize);
  resizeObserver?.observe(root);
  resize();
  render();

  return cleanup;
}
