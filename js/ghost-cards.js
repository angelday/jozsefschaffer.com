// Gallery: set flex ratio per image based on aspect ratio
document.querySelectorAll(".kg-gallery-image img").forEach(function (img) {
  const container = img.closest(".kg-gallery-image");
  const ratio = img.attributes.width.value / img.attributes.height.value;
  container.style.flex = ratio + " 1 0%";
});
