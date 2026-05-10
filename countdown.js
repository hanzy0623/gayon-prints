export function countdown(seconds, statusEl) {
  return new Promise((resolve) => {
    let remaining = seconds;
    statusEl.innerHTML = `<span class="countdown-anim"><i class="ri-camera-lens-line"></i> ${remaining}</span>`;

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        statusEl.innerHTML = `<span class="countdown-anim" style="animation: none;"><i class="ri-camera-lens-line"></i> ${remaining}</span>`;
        void statusEl.offsetWidth;
        statusEl.querySelector('.countdown-anim').style.animation = 'pop 0.4s ease-out forwards';
      } else {
        statusEl.innerHTML = `<span class="countdown-anim"><i class="ri-flashlight-fill"></i> Smile!</span>`;
      }

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeout(resolve, 400);
      }
    }, 1000);
  });
}
