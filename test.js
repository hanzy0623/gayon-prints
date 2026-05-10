
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const statusEl = document.getElementById("status");
    const flash = document.getElementById("flash");
    const controls = document.getElementById("controls");
    const booth = document.getElementById("booth");
    const reviewImage = document.getElementById("review-image");
    const templateSelector = document.getElementById("template-selector");

    let photos = [];
    let running = false;
    let currentTemplate = 'strip';

    // SETTINGS
    let settings = {
      event: "Gayon Prints",
      names: "",
      font: "'Space Mono', monospace",
      headerStyle: "event",
      timestamp: false,
      autoPrint: false,
      qrLink: ""
    };

    const saved = localStorage.getItem("booth");
    if (saved) settings = JSON.parse(saved);

    // CAMERA
    async function initCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusEl.innerHTML = "<i class='ri-error-warning-line'></i> Camera Error: Please run on localhost or HTTPS";
        return;
      }
      try {
        // Try to get a user-facing camera first (ideal for phones)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
      } catch (err) {
        // If that fails (often happens on desktop PCs without 'user' labeled webcams)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video.srcObject = stream;
        } catch (fallbackErr) {
          console.error(fallbackErr);
          statusEl.innerHTML = "<i class='ri-error-warning-line'></i> Camera Error (" + fallbackErr.name + ")";
        }
      }
    }
    initCamera();

    async function start(template) {
      if (running) return;
      running = true;
      currentTemplate = template;
      photos = [];
      controls.innerHTML = "";
      templateSelector.style.display = "none";

      // Fancy squish animation on start
      booth.style.transform = "scale(0.96)";
      setTimeout(() => booth.style.transform = "scale(1)", 200);

      let maxPhotos = 3;
      if (template === 'single') maxPhotos = 1;
      if (template === 'double') maxPhotos = 2;
      if (template === 'strip') maxPhotos = 3;
      if (template === 'grid') maxPhotos = 4;

      for (let i = 0; i < maxPhotos; i++) {
        await countdown(3);
        let photoCanvas = capture();

        let keep = await reviewPhoto(photoCanvas);
        if (!keep) {
          i--; // Retry this photo index
        } else {
          photos.push(photoCanvas);
        }
      }

      statusEl.innerHTML = "<i class='ri-loader-4-line ri-spin'></i> Processing...";

      setTimeout(() => {
        render();
        showButtons();
        statusEl.innerHTML = "<i class='ri-check-line'></i> All Done!";
        if (settings.autoPrint) {
          setTimeout(() => window.print(), 1000);
        }
      }, 1000);
    }

    // COUNTDOWN
    function countdown(sec) {
      return new Promise(res => {
        let c = sec;
        statusEl.innerHTML = \`<span class="countdown-anim"><i class="ri-camera-lens-line"></i> \${c}</span>\`;

        let i = setInterval(() => {
          c--;
          if (c > 0) {
            statusEl.innerHTML = \`<span class="countdown-anim" style="animation: none;"><i class="ri-camera-lens-line"></i> \${c}</span>\`;
            void statusEl.offsetWidth; // Force a reflow
            statusEl.querySelector('.countdown-anim').style.animation = 'pop 0.4s ease-out forwards';
          } else {
            statusEl.innerHTML = \`<span class="countdown-anim"><i class="ri-flashlight-fill"></i> Smile!</span>\`;
          }

          if (c <= 0) {
            clearInterval(i);
            setTimeout(res, 400); // Wait a fraction before capturing
          }
        }, 1000);
      });
    }

    // CAPTURE
    function capture() {
      flash.style.opacity = 0.9;
      setTimeout(() => flash.style.opacity = 0, 150);

      let temp = document.createElement("canvas");
      temp.width = 576;
      temp.height = 720;
      
      // Horizontally mirror the image, because the video preview is mirrored
      let tCtx = temp.getContext("2d");
      tCtx.translate(576, 0);
      tCtx.scale(-1, 1);
      tCtx.drawImage(video, 0, 0, 576, 720);
      
      return temp;
    }

    // REVIEW PHOTO
    function reviewPhoto(photoCanvas) {
      return new Promise(res => {
        reviewImage.src = photoCanvas.toDataURL("image/jpeg");
        reviewImage.style.display = "block";
        video.style.opacity = "0";

        statusEl.innerHTML = "Review Photo";
        controls.innerHTML = \`
          <button class="btn-primary" id="btn-keep"><i class="ri-check-line"></i> Keep</button>
          <button id="btn-retake"><i class="ri-refresh-line"></i> Retake</button>
        \`;

        document.getElementById("btn-keep").onclick = () => {
           video.style.opacity = "1";
           reviewImage.style.display = "none";
           controls.innerHTML = "";
           res(true);
        };
        document.getElementById("btn-retake").onclick = () => {
           video.style.opacity = "1";
           reviewImage.style.display = "none";
           controls.innerHTML = "";
           res(false);
        };
      });
    }

    // RENDER
    function render() {
      // Calculate canvas height
      let headerHeight = settings.headerStyle !== "none" ? (settings.headerStyle === "full" && settings.names ? 70 : 40) : 0;
      let footerHeight = settings.qrLink ? 150 : 50; 
      footerHeight += 40; // cutting line area
      let topY = 80;

      let cWidth = 576;
      let cHeight = 1100;
      let drawInfo = [];
      
      if (currentTemplate === 'single') {
         cHeight = topY + headerHeight + 600 + footerHeight;
         drawInfo.push({x: 48, y: topY + headerHeight, w: 480, h: 600});
      } else if (currentTemplate === 'double') {
         cHeight = topY + headerHeight + 300 + footerHeight;
         drawInfo.push({x: 36, y: topY + headerHeight, w: 240, h: 300});
         drawInfo.push({x: 300, y: topY + headerHeight, w: 240, h: 300});
      } else if (currentTemplate === 'strip') {
         cHeight = topY + headerHeight + (3 * 200) + footerHeight;
         drawInfo.push({x: 48, y: topY + headerHeight, w: 480, h: 180});
         drawInfo.push({x: 48, y: topY + headerHeight + 200, w: 480, h: 180});
         drawInfo.push({x: 48, y: topY + headerHeight + 400, w: 480, h: 180});
      } else if (currentTemplate === 'grid') {
         cHeight = topY + headerHeight + 640 + footerHeight;
         drawInfo.push({x: 38, y: topY + headerHeight, w: 240, h: 300});
         drawInfo.push({x: 298, y: topY + headerHeight, w: 240, h: 300});
         drawInfo.push({x: 38, y: topY + headerHeight + 320, w: 240, h: 300});
         drawInfo.push({x: 298, y: topY + headerHeight + 320, w: 240, h: 300});
      }

      canvas.width = cWidth;
      canvas.height = cHeight;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, cWidth, cHeight);

      let y = topY;
      ctx.fillStyle = "black";
      ctx.textAlign = "center";

      // HEADER
      if (settings.headerStyle !== "none") {
        if (settings.headerStyle === "full" && settings.names) {
          ctx.font = "20px " + settings.font;
          ctx.fillText(settings.names, cWidth/2, y);
          y += 30;
        }
        ctx.font = "bold 24px " + settings.font;
        ctx.fillText(settings.event, cWidth/2, y);
        y += 40; 
      }

      // PHOTOS
      photos.forEach((p, index) => {
        let info = drawInfo[index];
        ctx.drawImage(p, info.x, info.y, info.w, info.h);
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 2;
        ctx.strokeRect(info.x, info.y, info.w, info.h);
      });

      let footerY = cHeight - footerHeight + 20;

      // TIMESTAMP
      if (settings.timestamp) {
        ctx.font = "14px " + settings.font;
        ctx.fillText(new Date().toLocaleString(), cWidth/2, footerY);
        footerY += 30;
      }

      // QR + FOOTER
      if (settings.qrLink) {
        let qrCanvas = document.createElement("canvas");
        QRCode.toCanvas(qrCanvas, settings.qrLink, { width: 100, margin: 0 }, () => {
          ctx.drawImage(qrCanvas, (cWidth/2) - 50, footerY);
          ctx.font = "14px " + settings.font;
          ctx.fillText("Gayon Prints", cWidth/2, footerY + 130);
          finalizeRender(footerY + 170, cWidth);
        });
      } else {
        ctx.font = "14px " + settings.font;
        ctx.fillText("Gayon Prints", cWidth/2, footerY + 30);
        finalizeRender(footerY + 70, cWidth);
      }
    }

    function finalizeRender(cutY, cWidth) {
      ctx.font = "20px Arial";
      ctx.fillText("✂️ - - - - - - - - - - - - -", cWidth/2, cutY);
      canvas.classList.add("show");
      video.style.display = "none";
    }

    // BUTTONS
    function showButtons() {
      controls.innerHTML = \`
        <button class="btn-primary" onclick="window.print()"><i class="ri-printer-line"></i> Print</button>
        <button onclick="download()"><i class="ri-download-2-line"></i> Save</button>
        <button onclick="reset()"><i class="ri-refresh-line"></i> Home</button>
      \`;
    }

    function download() {
      let a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg");
      a.download = "gayon-booth-" + Date.now() + ".jpg";
      a.click();
    }

    function reset() {
      canvas.classList.remove("show");
      video.style.display = "block";
      reviewImage.style.display = "none";
      templateSelector.style.display = "flex";
      controls.innerHTML = "";
      statusEl.innerHTML = "<i class='ri-thumb-up-line'></i> Select a Layout";
      running = false;
    }

    // ADMIN (5 rapid taps to open)
    let taps = 0;
    document.getElementById("title").onclick = () => {
      taps++;
      if (taps >= 5) { openAdmin(); taps = 0; }
      setTimeout(() => taps = 0, 2000);
    };

    function openAdmin() {
      const adminPanel = document.getElementById("admin");
      adminPanel.classList.add("show");

      document.getElementById("eventInput").value = settings.event || "";
      document.getElementById("namesInput").value = settings.names || "";
      if(settings.font) document.getElementById("fontSelect").value = settings.font;
      if(settings.headerStyle) document.getElementById("headerStyle").value = settings.headerStyle;
      document.getElementById("timestampToggle").checked = !!settings.timestamp;
      document.getElementById("autoPrint").checked = !!settings.autoPrint;
      document.getElementById("qrLinkInput").value = settings.qrLink || "";
    }

    function closeAdmin() {
      document.getElementById("admin").classList.remove("show");
    }

    function saveSettings() {
      settings.event = document.getElementById("eventInput").value;
      settings.names = document.getElementById("namesInput").value;
      settings.font = document.getElementById("fontSelect").value;
      settings.headerStyle = document.getElementById("headerStyle").value;
      settings.timestamp = document.getElementById("timestampToggle").checked;
      settings.autoPrint = document.getElementById("autoPrint").checked;
      settings.qrLink = document.getElementById("qrLinkInput").value;

      localStorage.setItem("booth", JSON.stringify(settings));
      closeAdmin();
      
      if (!running && canvas.classList.contains('show')) {
          render(); 
      }
    }
  