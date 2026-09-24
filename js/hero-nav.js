export function initHeroNav() {
  const navItems = document.querySelectorAll("[data-scroll-target]");
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  navItems.forEach((item) => {
    if (!(item instanceof HTMLButtonElement)) {
      return;
    }

    item.addEventListener("click", () => {
      const selector = item.dataset.scrollTarget;

      if (!selector) {
        return;
      }

      const target = document.querySelector(selector);

      if (!(target instanceof HTMLElement)) {
        return;
      }

      target.scrollIntoView({
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
        block: "start",
      });
    });
  });
}
