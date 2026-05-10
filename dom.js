const canvas = document.getElementById("canvas");

export const elements = {
  video: document.getElementById("video"),
  canvas: canvas,
  ctx: canvas ? canvas.getContext("2d") : null,
  statusEl: document.getElementById("status"),
  flash: document.getElementById("flash"),
  controls: document.getElementById("controls"),
  booth: document.getElementById("booth"),
  reviewImage: document.getElementById("review-image"),
  templateSelector: document.getElementById("template-selector"),
  adminPanel: document.getElementById("admin"),
  title: document.getElementById("title"),
  eventInput: document.getElementById("eventInput"),
  namesInput: document.getElementById("namesInput"),
  fontSelect: document.getElementById("fontSelect"),
  headerStyle: document.getElementById("headerStyle"),
  qrLinkInput: document.getElementById("qrLinkInput"),
  timestampToggle: document.getElementById("timestampToggle"),
  autoPrint: document.getElementById("autoPrint"),
};
