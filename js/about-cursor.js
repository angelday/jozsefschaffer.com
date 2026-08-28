export function initAboutCursor() {
  const aboutSections = document.querySelectorAll("[data-about-cursor-root]");
  const cursor = document.querySelector("[data-about-cursor]");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const CURSOR_SCALE = 3;
  const POINTER_HOTSPOT_X = 8 * CURSOR_SCALE;
  const POINTER_HOTSPOT_Y = 0;
  const SELECT_HOTSPOT_X = 8 * CURSOR_SCALE;
  const SELECT_HOTSPOT_Y = 8 * CURSOR_SCALE;

  if (aboutSections.length === 0 || !(cursor instanceof HTMLElement)) {
    return;
  }

  if (!finePointerQuery.matches) {
    cursor.style.display = "none";
    return;
  }

  let isVisible = false;

  const updatePosition = (event) => {
    const isActiveTarget =
      event.target instanceof Element &&
      Boolean(event.target.closest("[data-about-cursor-active]"));
    const isSelectTarget =
      !isActiveTarget &&
      event.target instanceof Element &&
      Boolean(event.target.closest("[data-about-cursor-select]"));
    const hotspotX = isSelectTarget ? SELECT_HOTSPOT_X : POINTER_HOTSPOT_X;
    const hotspotY = isSelectTarget ? SELECT_HOTSPOT_Y : POINTER_HOTSPOT_Y;

    cursor.style.transform = `translate3d(${event.clientX - hotspotX}px, ${
      event.clientY - hotspotY
    }px, 0)`;
    cursor.classList.toggle("is-active", isActiveTarget);
    cursor.classList.toggle("is-select", isSelectTarget);
  };

  const showCursor = (event) => {
    isVisible = true;
    cursor.style.display = "block";
    updatePosition(event);
  };

  const hideCursor = () => {
    isVisible = false;
    cursor.style.display = "none";
    cursor.classList.remove("is-active");
    cursor.classList.remove("is-select");
  };

  aboutSections.forEach((section) => {
    section.addEventListener("pointerenter", showCursor);
    section.addEventListener("pointermove", (event) => {
      if (!isVisible) {
        showCursor(event);
        return;
      }

      updatePosition(event);
    });
    section.addEventListener("pointerleave", hideCursor);
  });
  window.addEventListener("blur", hideCursor);

  finePointerQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      hideCursor();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !isVisible) {
      hideCursor();
    }
  });
}
