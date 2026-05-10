export function reviewPhoto(photoCanvas, reviewImage, videoElement, controlsElement, statusEl) {
  return new Promise((resolve) => {
    reviewImage.src = photoCanvas.toDataURL('image/jpeg');

    reviewImage.style.display = 'block'; // ✅ only this
    videoElement.style.opacity = '0';

    statusEl.innerHTML = 'Review Photo';
    controlsElement.innerHTML = '';

    const keepButton = document.createElement('button');
    keepButton.className = 'btn-primary';
    keepButton.innerHTML = '<i class="ri-check-line"></i> Keep';
    keepButton.addEventListener('click', () => {
      videoElement.style.opacity = '1';
      reviewImage.style.display = 'none';
      controlsElement.innerHTML = '';
      resolve(true);
    });

    const retakeButton = document.createElement('button');
    retakeButton.innerHTML = '<i class="ri-refresh-line"></i> Retake';
    retakeButton.addEventListener('click', () => {
      videoElement.style.opacity = '1';
      reviewImage.style.display = 'none';
      controlsElement.innerHTML = '';
      resolve(false);
    });

    controlsElement.append(keepButton, retakeButton);
  });
}
