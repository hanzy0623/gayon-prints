export function capture(videoElement, flashElement) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const w = videoElement.videoWidth;
  const h = videoElement.videoHeight;

  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(videoElement, 0, 0, ws, h);

  return canvas;
}
as 