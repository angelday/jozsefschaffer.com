const vertexShaderSource = `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uResolution;
uniform float uSpeed;
uniform float uCameraZoom;
uniform vec2 uCameraPan;
uniform float uTextureAmount;
uniform float uPatternFade;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uUseWhite;
uniform float uUseGrayOnly;
uniform float uReveal;

const int depth = 4;

// CGA palette 1 low intensity — dim controls output brightness
const float dim = 1.0;
const vec3 CGA_BLACK   = vec3(0.0, 0.0, 0.0);
const vec3 CGA_CYAN    = dim * vec3(0.0, 0.667, 0.667);
const vec3 CGA_MAGENTA = dim * vec3(0.667, 0.0, 0.667);
const vec3 CGA_WHITE   = dim * vec3(0.667, 0.667, 0.667);

vec3 nearestCGA(vec3 col) {
  vec3 best = CGA_BLACK;
  float bestDist = distance(col, CGA_BLACK);

  float d = distance(col, CGA_MAGENTA);
  if (d < bestDist) { bestDist = d; best = CGA_MAGENTA; }

  d = distance(col, CGA_CYAN);
  if (d < bestDist) { bestDist = d; best = CGA_CYAN; }

  if (uUseWhite > 0.5) {
    d = distance(col, CGA_WHITE);
    if (d < bestDist) { bestDist = d; best = CGA_WHITE; }
  }

  return best;
}

vec3 nearestGray(vec3 col) {
  const vec3 CGA_GRAY = vec3(0.667, 0.667, 0.667);
  float blackDist = distance(col, CGA_BLACK);
  float grayDist = distance(col, CGA_GRAY);
  return grayDist < blackDist ? CGA_GRAY : CGA_BLACK;
}

float orderedReveal(vec2 cell) {
  float threshold = 0.0;
  threshold += step(1.0, mod(cell.x, 2.0)) * 0.5;
  threshold += step(1.0, mod(cell.y, 2.0)) * 0.25;
  threshold += step(2.0, mod(cell.x, 4.0)) * 0.125;
  threshold += step(2.0, mod(cell.y, 4.0)) * 0.0625;
  return threshold;
}

vec2 effect(vec2 p, float i, float time) {
  return vec2(
    cos(i * sin(p.x * p.y) + time),
    sin(length(p.y - p.x) * i + time)
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Quantize to low-res grid
  float pixelSize = 8.0;
  vec2 cell = floor(fragCoord / pixelSize);
  vec2 snapped = (cell + 0.5) * pixelSize;

  vec2 p = (2.0 * snapped - iResolution.xy) / max(iResolution.x, iResolution.y);
  p *= uResolution;
  p = (p / max(uCameraZoom, 0.01)) + uCameraPan;

  for (int i = 1; i < depth; i++) {
    float fi = float(i);
    p += effect(p, fi, iTime * uSpeed);
  }

  vec3 col = mix(
    mix(uColor1, uColor2, 1.0 - sin(p.x)),
    uColor3,
    cos(p.y + p.x)
  );

  col *= 0.75;

  // Checkerboard dither to CGA palette
  float checker = mod(cell.x + cell.y, 2.0);
  col += (checker - 0.5) * uTextureAmount;

  vec3 cga = uUseGrayOnly > 0.5 ? nearestGray(col) : nearestCGA(col);
  float reveal = clamp(uReveal, 0.0, 1.0);
  float patternFade = clamp(uPatternFade, 0.0, 1.0);
  float cellThreshold = orderedReveal(cell);
  float revealMask = step(cellThreshold, reveal) * step(0.001, reveal);
  float patternMask = step(cellThreshold + 0.03125, patternFade) * step(0.001, patternFade);
  float mask = revealMask * patternMask;
  vec3 fadeBase = uUseGrayOnly > 0.5 ? CGA_WHITE : CGA_BLACK;
  fragColor = vec4(mix(fadeBase, cga, mask), 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

const PRESETS = {
  hero: {
    resolution: 2.0,
    speed: 0.1,
    colors: [
      [0x00 / 255, 0xAA / 255, 0xAA / 255],
      [0xAA / 255, 0x00 / 255, 0xAA / 255],
      [0, 0, 0],
    ],
  },
  projects: {
    resolution: 1.1,
    speed: 0.1,
    cameraZoom: 0.88,
    cameraPan: [2, 2],
    textureAmount: 0.71,
    patternFade: 0.5,
    useGrayOnly: true,
    colors: [
      [0xAA / 255, 0xAA / 255, 0xAA / 255],
      [0x58 / 255, 0x58 / 255, 0x58 / 255],
      [0, 0, 0],
    ],
  },
  contact: {
    resolution: 2.8,
    speed: 0.08,
    colors: [
      [229 / 255, 229 / 255, 229 / 255],
      [221 / 255, 221 / 255, 221 / 255],
      [236 / 255, 236 / 255, 236 / 255],
    ],
  },
  "contact-linkedin": {
    resolution: 2.55,
    speed: 0.075,
    colors: [
      [0, 1, 1],
      [0, 0, 0],
      [0, 0.85, 0.95],
    ],
  },
  "contact-email": {
    resolution: 3.1,
    speed: 0.095,
    colors: [
      [1, 0, 1],
      [0, 0, 0],
      [0.95, 0, 0.85],
    ],
  },
  "contact-linkedin-hover": {
    resolution: 2.55,
    speed: 0.32,
    colors: [
      [0, 1, 1],
      [1, 1, 1],
      [0, 0.9, 0.9],
    ],
  },
  "contact-email-hover": {
    resolution: 3.1,
    speed: 0.4,
    colors: [
      [1, 0, 1],
      [1, 1, 1],
      [0.9, 0, 0.9],
    ],
  },
};

const COLOR_FADE_MS = 150;
const SHADER_REVEAL_MS = 900;
const SHADER_REVEAL_TARGET = 0.2;
const SHADER_CLEANUP_KEY = "__heroShaderCleanup";

function createShader(gl, type, source) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("Could not allocate shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  const message = gl.getShaderInfoLog(shader) || "Unknown shader error.";
  gl.deleteShader(shader);
  throw new Error(message);
}

function createProgram(gl) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Could not allocate program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown linking error.";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(message);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function getShaderPreset(canvas) {
  const presetName = canvas.dataset.shaderPreset || "hero";
  return PRESETS[presetName] || PRESETS.hero;
}

function cloneColors(colors) {
  return colors.map((color) => [...color]);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function mixColors(fromColors, toColors, progress) {
  return fromColors.map((fromColor, index) =>
    fromColor.map((channel, channelIndex) =>
      lerp(channel, toColors[index][channelIndex], progress)
    )
  );
}

function setupInteractivePreset(canvas, setPreset) {
  const basePresetName = canvas.dataset.shaderPreset || "hero";
  const hoverPresetName = canvas.dataset.shaderHoverPreset;
  const card = canvas.closest(".section__contact-card");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (!hoverPresetName || !(card instanceof HTMLElement)) {
    return () => {};
  }

  const activateHover = () => {
    setPreset(hoverPresetName);
  };

  const deactivateHover = () => {
    setPreset(basePresetName);
  };

  const handleFocus = () => {
    if (card.matches(":focus-visible")) {
      activateHover();
    }
  };
  const handlePointerChange = (event) => {
    if (!event.matches) {
      deactivateHover();
    }
  };

  if (!finePointerQuery.matches) {
    deactivateHover();
  }

  card.addEventListener("pointerenter", activateHover);
  card.addEventListener("pointerleave", deactivateHover);
  card.addEventListener("focus", handleFocus);
  card.addEventListener("blur", deactivateHover);
  finePointerQuery.addEventListener("change", handlePointerChange);

  return () => {
    card.removeEventListener("pointerenter", activateHover);
    card.removeEventListener("pointerleave", deactivateHover);
    card.removeEventListener("focus", handleFocus);
    card.removeEventListener("blur", deactivateHover);
    finePointerQuery.removeEventListener("change", handlePointerChange);
  };
}

function mountShader(canvas) {
  if (typeof canvas[SHADER_CLEANUP_KEY] === "function") {
    canvas[SHADER_CLEANUP_KEY]();
  }

  const initialPreset = getShaderPreset(canvas);
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });

  if (!gl) {
    canvas.remove();
    return;
  }

  gl.disable(gl.BLEND);
  gl.disable(gl.DITHER);

  let animationFrame = 0;
  let program;
  let positionBuffer;
  let preset = initialPreset;
  let startColors = cloneColors(preset.colors);
  let currentColors = cloneColors(preset.colors);
  let targetColors = cloneColors(preset.colors);
  let startSpeed = preset.speed;
  let currentSpeed = preset.speed;
  let targetSpeed = preset.speed;
  let colorTransitionStart = 0;
  let phaseTime = 0;
  let lastFrameTime = 0;
  const hasIntroFade = canvas.hasAttribute("data-shader-intro-fade");
  const revealTarget = hasIntroFade ? SHADER_REVEAL_TARGET : 1;
  let revealProgress =
    hasIntroFade && document.documentElement.classList.contains("hero-intro-active")
      ? 0
      : revealTarget;
  let revealStart = 0;
  let isRendering = false;
  let isVisible = true;
  let cleanupInteractivePreset = () => {};
  let visibilityObserver = null;

  try {
    program = createProgram(gl);
    positionBuffer = gl.createBuffer();

    if (!positionBuffer) {
      throw new Error("Could not allocate buffer.");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const positionAttribute = gl.getAttribLocation(program, "position");
    const resolutionUniform = gl.getUniformLocation(program, "iResolution");
    const timeUniform = gl.getUniformLocation(program, "iTime");
    const scaleUniform = gl.getUniformLocation(program, "uResolution");
    const speedUniform = gl.getUniformLocation(program, "uSpeed");
    const cameraZoomUniform = gl.getUniformLocation(program, "uCameraZoom");
    const cameraPanUniform = gl.getUniformLocation(program, "uCameraPan");
    const textureAmountUniform = gl.getUniformLocation(program, "uTextureAmount");
    const patternFadeUniform = gl.getUniformLocation(program, "uPatternFade");
    const colorOneUniform = gl.getUniformLocation(program, "uColor1");
    const colorTwoUniform = gl.getUniformLocation(program, "uColor2");
    const colorThreeUniform = gl.getUniformLocation(program, "uColor3");
    const useWhiteUniform = gl.getUniformLocation(program, "uUseWhite");
    const useGrayOnlyUniform = gl.getUniformLocation(program, "uUseGrayOnly");
    const revealUniform = gl.getUniformLocation(program, "uReveal");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now) => {
      if (!isRendering) return;

      resize();

      if (lastFrameTime === 0) {
        lastFrameTime = now;
      }

      const deltaTime = Math.max(0, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (colorTransitionStart > 0) {
        const progress = Math.min(
          1,
          (now - colorTransitionStart) / COLOR_FADE_MS
        );
        currentColors = mixColors(startColors, targetColors, progress);
        currentSpeed = lerp(startSpeed, targetSpeed, progress);

        if (progress >= 1) {
          colorTransitionStart = 0;
          startColors = cloneColors(targetColors);
          startSpeed = targetSpeed;
        }
      }

      phaseTime += deltaTime * currentSpeed;

      if (revealStart > 0) {
        const progress = Math.min(1, (now - revealStart) / SHADER_REVEAL_MS);
        revealProgress = revealTarget * progress;

        if (progress >= 1) {
          revealProgress = revealTarget;
          revealStart = 0;
        }
      }

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionAttribute);
      gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform1f(timeUniform, phaseTime);
      gl.uniform1f(scaleUniform, preset.resolution);
      gl.uniform1f(speedUniform, 1);
      gl.uniform1f(cameraZoomUniform, preset.cameraZoom ?? 1);
      gl.uniform2f(
        cameraPanUniform,
        preset.cameraPan?.[0] ?? 0,
        preset.cameraPan?.[1] ?? 0
      );
      gl.uniform1f(textureAmountUniform, preset.textureAmount ?? 0.35);
      gl.uniform1f(patternFadeUniform, preset.patternFade ?? 1);
      gl.uniform3f(colorOneUniform, ...currentColors[0]);
      gl.uniform3f(colorTwoUniform, ...currentColors[1]);
      gl.uniform3f(colorThreeUniform, ...currentColors[2]);
      gl.uniform1f(useWhiteUniform, preset.useWhite === false ? 0 : 1);
      gl.uniform1f(useGrayOnlyUniform, preset.useGrayOnly === true ? 1 : 0);
      gl.uniform1f(revealUniform, revealProgress);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animationFrame = window.requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (isRendering || document.hidden || !isVisible) return;
      isRendering = true;
      animationFrame = window.requestAnimationFrame(render);
    };

    const stopRendering = () => {
      isRendering = false;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        lastFrameTime = 0;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopRendering();
      } else {
        startRendering();
      }
    };

    const startIntroReveal = () => {
      if (!hasIntroFade) return;
      revealProgress = 0;
      revealStart = performance.now();
      startRendering();
    };

    cleanupInteractivePreset = setupInteractivePreset(canvas, (presetName) => {
      const nextPreset = PRESETS[presetName] || PRESETS.hero;
      preset = nextPreset;
      startColors = cloneColors(currentColors);
      targetColors = cloneColors(nextPreset.colors);
      startSpeed = currentSpeed;
      targetSpeed = nextPreset.speed;
      colorTransitionStart = performance.now();
    });

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("hero-domain-warp-reveal", startIntroReveal);

    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
          if (isVisible) {
            startRendering();
          } else {
            stopRendering();
          }
        },
        { rootMargin: "200px 0px" }
      );
      visibilityObserver.observe(canvas);
    } else {
      startRendering();
    }

    let didCleanup = false;
    const cleanup = () => {
      if (didCleanup) return;
      didCleanup = true;
      stopRendering();
      cleanupInteractivePreset();
      visibilityObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("hero-domain-warp-reveal", startIntroReveal);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas[SHADER_CLEANUP_KEY] = null;
    };

    canvas[SHADER_CLEANUP_KEY] = cleanup;
    return cleanup;
  } catch (error) {
    console.error("Hero shader failed to initialize.", error);
    canvas.remove();
  }
}

export function initHeroShader() {
  const canvases = document.querySelectorAll("[data-shader-canvas]");
  const cleanups = [];

  canvases.forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) {
      const cleanup = mountShader(canvas);
      if (typeof cleanup === "function") {
        cleanups.push(cleanup);
      }
    }
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
