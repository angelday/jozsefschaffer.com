// Lightbox
(function () {
  // Build lightbox DOM
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.innerHTML =
    '<div class="lightbox-content">' +
    '<img class="lightbox-img" draggable="false" />' +
    "</div>" +
    '<div class="lightbox-controls">' +
    '<button class="lightbox-prev" aria-label="Previous">Previous</button>' +
    '<button class="lightbox-close" aria-label="Close">Close</button>' +
    '<button class="lightbox-next" aria-label="Next">Next</button>' +
    "</div>";
  document.body.appendChild(overlay);

  const content = overlay.querySelector(".lightbox-content");
  const img = overlay.querySelector(".lightbox-img");
  const prevBtn = overlay.querySelector(".lightbox-prev");
  const nextBtn = overlay.querySelector(".lightbox-next");
  let images = [];
  let current = 0;

  // Pan state
  var OVERSHOOT = 48; // px of extra drag room past each edge
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;

  function applyTransform() {
    img.style.transform = "translate(" + translateX + "px, " + translateY + "px)";
  }

  function clampTranslate(hard) {
    var imgWidth = img.offsetWidth;
    var imgHeight = img.offsetHeight;
    var maskWidth = content.offsetWidth;
    var maskHeight = content.offsetHeight;
    var extra = hard ? 0 : OVERSHOOT;
    // flex-start origin: translate(0,0) = image top-left at mask top-left
    var minX = -Math.max(0, imgWidth - maskWidth) - extra;
    var maxX = extra;
    var minY = -Math.max(0, imgHeight - maskHeight) - extra;
    var maxY = extra;
    translateX = Math.max(minX, Math.min(maxX, translateX));
    translateY = Math.max(minY, Math.min(maxY, translateY));
  }

  // Animate snap-back to hard bounds after overshoot
  var snapFrame = 0;
  function snapBack() {
    cancelAnimationFrame(snapFrame);
    var imgWidth = img.offsetWidth;
    var imgHeight = img.offsetHeight;
    var maskWidth = content.offsetWidth;
    var maskHeight = content.offsetHeight;
    var minX = -Math.max(0, imgWidth - maskWidth);
    var maxX = 0;
    var minY = -Math.max(0, imgHeight - maskHeight);
    var maxY = 0;
    var targetX = Math.max(minX, Math.min(maxX, translateX));
    var targetY = Math.max(minY, Math.min(maxY, translateY));
    function step() {
      var dx = targetX - translateX;
      var dy = targetY - translateY;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        translateX = targetX;
        translateY = targetY;
        applyTransform();
        return;
      }
      translateX += dx * 0.25;
      translateY += dy * 0.25;
      applyTransform();
      snapFrame = requestAnimationFrame(step);
    }
    if (translateX !== targetX || translateY !== targetY) {
      snapFrame = requestAnimationFrame(step);
    }
  }

  function resetPan() {
    cancelAnimationFrame(snapFrame);
    translateX = 0;
    translateY = 0;
    overlay.classList.remove("lightbox-dragging");
    img.style.transform = "";
  }

  function show(index) {
    resetPan();
    current = index;
    // Use the highest resolution src available
    const source = images[current];
    img.src = source.srcset
      ? source.srcset.split(",").pop().trim().split(" ")[0]
      : source.src;
    // Display at 75% of intrinsic size, start at overshoot offset
    img.onload = function () {
      img.style.maxWidth = (img.naturalWidth * 0.75) + "px";
      img.style.maxHeight = (img.naturalHeight * 0.75) + "px";
      // Start with overshoot visible at top-left
      translateX = OVERSHOOT;
      translateY = OVERSHOOT;
      applyTransform();
    };
    // Show prev/next only for galleries
    var isGallery = images.length > 1;
    prevBtn.style.display = isGallery ? "" : "none";
    nextBtn.style.display = isGallery ? "" : "none";
    overlay.classList.add("lightbox-open");
    document.body.style.overflow = "hidden";
  }

  function hide() {
    resetPan();
    overlay.classList.remove("lightbox-open");
    document.body.style.overflow = "";
    img.src = "";
  }

  function next() {
    show((current + 1) % images.length);
  }

  function prev() {
    show((current - 1 + images.length) % images.length);
  }

  // Click on gallery or standalone images
  document.querySelectorAll(".kg-gallery-image img, .kg-image-card img").forEach(function (el) {
    if (el.hasAttribute("data-no-lightbox")) return;
    if (el.closest(".kg-gallery-card[data-no-lightbox]")) return;
    el.style.cursor = "pointer";
    el.addEventListener("click", function () {
      // Collect all images in the same gallery, or just this one
      const gallery = el.closest(".kg-gallery-card");
      if (gallery) {
        images = Array.from(gallery.querySelectorAll("img")).filter(function (im) {
          return !im.hasAttribute("data-no-lightbox");
        });
        current = images.indexOf(el);
      } else {
        images = [el];
        current = 0;
      }
      show(current);
    });
  });

  // Controls
  overlay.querySelector(".lightbox-close").addEventListener("click", hide);
  overlay.querySelector(".lightbox-prev").addEventListener("click", function (e) {
    e.stopPropagation();
    prev();
  });
  overlay.querySelector(".lightbox-next").addEventListener("click", function (e) {
    e.stopPropagation();
    next();
  });

  // Swallow image clicks (so overlay click-to-close doesn't trigger mid-drag)
  img.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Prevent Safari's native image drag
  img.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });

  // Drag to pan
  img.addEventListener("mousedown", function (e) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;
    overlay.classList.add("lightbox-dragging");
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;
    e.preventDefault();
    translateX = startTranslateX + (e.clientX - dragStartX);
    translateY = startTranslateY + (e.clientY - dragStartY);
    clampTranslate();
    applyTransform();
  });

  document.addEventListener("mouseup", function () {
    if (!isDragging) return;
    isDragging = false;
    overlay.classList.remove("lightbox-dragging");
    snapBack();
  });

  // Click overlay background to close
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.className === "lightbox-content") {
      hide();
    }
  });

  // Keyboard
  document.addEventListener("keydown", function (e) {
    if (!overlay.classList.contains("lightbox-open")) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // Touch support for mobile — drag to pan with inertia
  let lastTouchX = 0;
  let lastTouchY = 0;
  let lastTouchTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let inertiaFrame = 0;

  img.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    cancelAnimationFrame(inertiaFrame);
    cancelAnimationFrame(snapFrame);
    var t = e.touches[0];
    startTranslateX = translateX;
    startTranslateY = translateY;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    lastTouchTime = Date.now();
    velocityX = 0;
    velocityY = 0;
    isDragging = true;
    overlay.classList.add("lightbox-dragging");
  }, { passive: true });

  img.addEventListener("touchmove", function (e) {
    if (!isDragging || e.touches.length !== 1) return;
    var t = e.touches[0];
    var now = Date.now();
    var dt = now - lastTouchTime;
    if (dt > 0) {
      velocityX = (t.clientX - lastTouchX) / dt;
      velocityY = (t.clientY - lastTouchY) / dt;
    }
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    lastTouchTime = now;
    translateX = startTranslateX + (t.clientX - dragStartX);
    translateY = startTranslateY + (t.clientY - dragStartY);
    clampTranslate();
    applyTransform();
    e.preventDefault();
  }, { passive: false });

  img.addEventListener("touchend", function () {
    if (!isDragging) return;
    isDragging = false;
    overlay.classList.remove("lightbox-dragging");

    // Inertia — coast based on release velocity
    var friction = 0.97;
    var vx = velocityX * 24; // scale to per-frame
    var vy = velocityY * 24;

    function coast() {
      if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
        snapBack();
        return;
      }
      vx *= friction;
      vy *= friction;
      translateX += vx;
      translateY += vy;
      clampTranslate();
      applyTransform();
      inertiaFrame = requestAnimationFrame(coast);
    }
    inertiaFrame = requestAnimationFrame(coast);
  }, { passive: true });
})();
