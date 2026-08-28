import { initAboutCursor } from "./about-cursor.js";
import { initHeroNav } from "./hero-nav.js";
import { initHeroRasterReveal } from "./hero-raster-reveal.js";
import { initHeroShader } from "./hero-shader.js";
import "./link-runtime.js";
import { playSound } from "./pc-sound.js";

const cleanupHeroShader = initHeroShader();
const introRoot = document.querySelector("[data-hero-raster-reveal]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let cleanupHeroRasterReveal = null;

function startHeroShaderReveal() {
  const root = document.documentElement;

  if (root.classList.contains("hero-shader-live")) {
    return;
  }

  root.classList.add("hero-shader-live");
  document.dispatchEvent(new CustomEvent("hero-domain-warp-reveal"));
}

function completeHeroIntro() {
  const root = document.documentElement;

  startHeroShaderReveal();
  root.classList.add("hero-title-visible");

  window.setTimeout(() => {
    root.classList.add("hero-page-live");
  }, 700);

  window.setTimeout(() => {
    root.classList.remove("hero-intro-active");
  }, 1700);
}

if (introRoot && !reduceMotion.matches) {
  initHeroRasterReveal({
    root: introRoot,
    onHandoff: startHeroShaderReveal,
    onComplete: completeHeroIntro,
  })
    .then((cleanup) => {
      cleanupHeroRasterReveal = cleanup;
    })
    .catch((error) => {
      console.error("Hero raster reveal failed to initialize.", error);
      completeHeroIntro();
    });
} else {
  document.documentElement.classList.remove("hero-intro-active");
}

initHeroNav();
initAboutCursor();

document.querySelectorAll("[data-pc-sound]").forEach((el) => {
  el.addEventListener("click", (e) => {
    const href = el.closest("a")?.href;
    if (href) e.preventDefault();
    playSound(el.dataset.pcSound, {
      onStart: () => el.dispatchEvent(new CustomEvent("pc-sound-start")),
    }).then(() => {
      el.dispatchEvent(new CustomEvent("pc-sound-end"));
      if (href) window.location.href = href;
    });
  });
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupHeroShader?.();
    cleanupHeroRasterReveal?.();
  });
}
