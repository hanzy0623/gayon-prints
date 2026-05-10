(function () {
  "use strict";

  const SETTINGS_KEY = "gayonBoothPro.settings.v1";
  const LOGS_KEY = "gayonBoothPro.logs.v1";
  const DEFAULT_SETTINGS = {
    eventTitle: "Gayon Booth Pro",
    eventSubtitle: "Tap to start your photo session",
    liveBranding: "Premium Prints",
    fontFamily: "'Montserrat', sans-serif",
    headerStyle: "neon",
    autoPrint: false,
    showTimestamp: false,
    qrEnabled: false,
    qrLink: "",
    defaultTemplate: "strip",
    printDpi: 300,
    printerProfile: "photo",
    printEngine: "browser",
    autoCut: false,
    receiptQuality: "balanced",
    receiptRenderMode: "grayscale",
    receiptBrightness: 12,
    receiptContrast: 1.0,
    filterMode: "none",
    headerImageData: "",
    footerLogoData: ""
  };

  const TEMPLATE_MAP = {
    strip: { widthIn: 2, heightIn: 6, shots: 3, mode: "stack3" },
    grid: { widthIn: 4, heightIn: 6, shots: 4, mode: "grid2x2" },
    polaroid: { widthIn: 4, heightIn: 4, shots: 1, mode: "polaroid1" },
    double: { widthIn: 4, heightIn: 6, shots: 2, mode: "double2" }
  };

  let stream = null;
  let settings = loadSettings();
  let sessionShots = [];
  let currentReviewResolver = null;
  let composedCanvas = null;
  let composedTemplateKey = "strip";
  let resultAutoResetTimer = null;

  const ui = {
    app: byId("app"),
    startScreen: byId("startScreen"),
    kioskScreen: byId("kioskScreen"),
    reviewScreen: byId("reviewScreen"),
    resultScreen: byId("resultScreen"),
    tapStartBtn: byId("tapStartBtn"),
    backToStartBtn: byId("backToStartBtn"),
    captureFlowBtn: byId("captureFlowBtn"),
    templateSelect: byId("templateSelect"),
    countdown: byId("countdownOverlay"),
    preview: byId("preview"),
    flashLayer: byId("flashLayer"),
    reviewImage: byId("reviewImage"),
    retakeBtn: byId("retakeBtn"),
    keepBtn: byId("keepBtn"),
    resultImage: byId("resultImage"),
    printBtn: byId("printBtn"),
    saveBtn: byId("saveBtn"),
    newSessionBtn: byId("newSessionBtn"),
    printStatus: byId("printStatus"),
    adminFooterBtn: byId("adminFooterBtn"),
    adminFooterHint: byId("adminFooterHint"),
    sessionCount: byId("sessionCount"),
    eventTitle: byId("eventTitle"),
    eventSubtitle: byId("eventSubtitle"),
    liveEventTitle: byId("liveEventTitle"),
    liveBranding: byId("liveBranding"),
    qrWrap: byId("qrWrap"),
    qrTarget: byId("qrTarget")
  };

  init();

  function init() {
    applyBranding();
    bindUI();
    ui.templateSelect.value = settings.defaultTemplate;
    ui.sessionCount.textContent = String(loadLogs().length);
    void startCamera();
  }

  function bindUI() {
    ui.tapStartBtn.addEventListener("click", async () => {
      await enterFullscreen();
      showScreen("kioskScreen");
    });

    ui.backToStartBtn.addEventListener("click", () => {
      showScreen("startScreen");
    });

    ui.captureFlowBtn.addEventListener("click", async () => {
      ui.captureFlowBtn.disabled = true;
      try {
        await runCaptureFlow(ui.templateSelect.value);
      } finally {
        ui.captureFlowBtn.disabled = false;
      }
    });

    ui.retakeBtn.addEventListener("click", () => resolveReview(false));
    ui.keepBtn.addEventListener("click", () => resolveReview(true));

    ui.printBtn.addEventListener("click", () => {
      if (!composedCanvas) {
        return;
      }
      void printCanvas(composedCanvas, composedTemplateKey, true);
    });

    ui.saveBtn.addEventListener("click", () => {
      if (!composedCanvas) {
        return;
      }
      const a = document.createElement("a");
      a.href = composedCanvas.toDataURL("image/png");
      a.download = `gayon-${Date.now()}.png`;
      a.click();
    });

    ui.newSessionBtn.addEventListener("click", () => {
      resetToStart();
    });

    bindAdminFooterTrigger();
  }

  function bindAdminFooterTrigger() {
    let armTimer = null;
    let armed = false;
    let clickCount = 0;

    const openAdmin = () => {
      window.location.href = "./admin.html";
    };

    ui.adminFooterBtn.addEventListener("click", () => {
      clickCount += 1;
      if (clickCount >= 2) {
        if (armTimer) {
          clearTimeout(armTimer);
          armTimer = null;
        }
        clickCount = 0;
        armed = false;
        ui.adminFooterHint.textContent = "Opening admin...";
        openAdmin();
        return;
      }

      if (!armed) {
        armed = true;
        ui.adminFooterHint.textContent = "Tap again to open admin";
        armTimer = setTimeout(() => {
          armed = false;
          clickCount = 0;
          ui.adminFooterHint.textContent = "Tap once then tap again to open";
        }, 1800);
      } else {
        openAdmin();
      }
    });
  }

  function applyBranding() {
    document.body.style.fontFamily = settings.fontFamily;
    ui.eventTitle.textContent = settings.eventTitle;
    ui.eventSubtitle.textContent = settings.eventSubtitle;
    ui.liveEventTitle.textContent = settings.eventTitle;
    ui.liveBranding.textContent = settings.liveBranding;

    const root = document.documentElement;
    if (settings.headerStyle === "minimal") {
      root.style.setProperty("--accent", "#f6f7ff");
    } else if (settings.headerStyle === "luxury") {
      root.style.setProperty("--accent", "#fbd67f");
    } else {
      root.style.setProperty("--accent", "#26ffd5");
    }
  }

  async function startCamera() {
    const attempts = [
      { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false }
    ];

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        ui.preview.srcObject = stream;
        await ui.preview.play();
        return;
      } catch (error) {
        console.warn("Camera attempt failed", constraints, error);
      }
    }
    alert("Unable to access camera. Please allow camera permissions.");
  }

  async function runCaptureFlow(templateKey) {
    const dpi = normalizeDpi(settings.printDpi);
    const selectedTemplateKey = normalizeTemplateKey(templateKey);
    const template = TEMPLATE_MAP[selectedTemplateKey];
    sessionShots = [];
    hideControls(true);

    for (let i = 0; i < template.shots; i += 1) {
      let accepted = false;
      while (!accepted) {
        await runCountdown(3);
        triggerFlash();
        const shotCanvas = captureFrameCanvasForTemplate(selectedTemplateKey, dpi);
        applySelectedFilter(shotCanvas);
        const keep = await reviewShot(shotCanvas);
        if (keep) {
          sessionShots.push(shotCanvas);
          accepted = true;
        }
      }
    }

    const finalTemplateKey = selectedTemplateKey;
    const profile = normalizePrinterProfile(settings.printerProfile);
    composedCanvas = await composeTemplate(finalTemplateKey, sessionShots, dpi, profile);
    composedTemplateKey = finalTemplateKey;
    ui.resultImage.src = composedCanvas.toDataURL("image/png");
    buildQrPreview();
    showScreen("resultScreen");
    scheduleResultAutoReset();
    hideControls(false);
    appendSessionLog(finalTemplateKey, sessionShots.length);
    ui.sessionCount.textContent = String(loadLogs().length);

    if (settings.autoPrint) {
      void printCanvas(composedCanvas, finalTemplateKey, false);
    }
  }

  function captureFrameCanvasForTemplate(templateKey, dpi) {
    const t = TEMPLATE_MAP[templateKey];
    const widthPx = Math.round(t.widthIn * dpi);
    const heightPx = Math.round(t.heightIn * dpi);
    const longest = Math.max(widthPx, heightPx);
    const targetH = Math.min(Math.max(longest, 1200), 2400);
    const targetW = Math.round(targetH * (3 / 4));
    return captureFrameCanvas(targetW, targetH);
  }

  function captureFrameCanvas(targetW, targetH) {
    const vw = ui.preview.videoWidth || 1280;
    const vh = ui.preview.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const scale = Math.max(targetW / vw, targetH / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const offsetX = (targetW - drawW) / 2;
    const offsetY = (targetH - drawH) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(ui.preview, offsetX, offsetY, drawW, drawH);
    return canvas;
  }

  async function composeTemplate(templateKey, shots, dpi, printerProfile) {
    const config = TEMPLATE_MAP[templateKey];
    const widthPx = Math.round(config.widthIn * dpi);
    const heightPx = Math.round(config.heightIn * dpi);
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);

    const margin = Math.round(widthPx * 0.05);
    const receiptMode = printerProfile === "receipt80";
    const sectionGap = Math.round(heightPx * (receiptMode ? 0.012 : 0.02));
    const headerZoneHeight = Math.round(heightPx * (receiptMode ? 0.06 : 0.1));
    const qrZoneHeight = settings.qrEnabled && settings.qrLink ? Math.round(heightPx * (receiptMode ? 0.1 : 0.14)) : 0;
    const footerZoneHeight = Math.round(heightPx * (receiptMode ? 0.06 : 0.09));
    const hasHeader = Boolean(settings.headerImageData);
    const hasFooter = Boolean(settings.footerLogoData);

    let usableTop = margin;
    if (hasHeader) {
      await drawHeaderImageIfAny(ctx, widthPx, heightPx, margin, headerZoneHeight);
      usableTop += headerZoneHeight + sectionGap;
    }

    let usableBottom = heightPx - margin;
    if (hasFooter) {
      await drawFooterImageIfAny(ctx, widthPx, heightPx, margin, footerZoneHeight);
      usableBottom -= footerZoneHeight + sectionGap;
    }

    let qrZoneTop = 0;
    if (qrZoneHeight > 0) {
      qrZoneTop = usableBottom - qrZoneHeight;
      drawQrZone(ctx, widthPx, margin, qrZoneTop, qrZoneHeight);
      usableBottom = qrZoneTop - sectionGap;
    }

    const usableHeight = Math.max(200, usableBottom - usableTop);

    if (config.mode === "stack3") {
      const gap = Math.round(heightPx * 0.015);
      const slotH = Math.floor((usableHeight - gap * 2) / 3);
      for (let i = 0; i < 3; i += 1) {
        drawImageCover(ctx, shots[i], margin, usableTop + i * (slotH + gap), widthPx - margin * 2, slotH);
      }
    } else if (config.mode === "grid2x2") {
      const gap = Math.round(widthPx * 0.03);
      const cellW = Math.floor((widthPx - margin * 2 - gap) / 2);
      const cellH = Math.floor((usableHeight - gap) / 2);
      for (let i = 0; i < 4; i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + col * (cellW + gap);
        const y = usableTop + row * (cellH + gap);
        drawImageCover(ctx, shots[i], x, y, cellW, cellH);
      }
    } else if (config.mode === "double2") {
      const gap = Math.round(usableHeight * 0.03);
      const slotH = Math.floor((usableHeight - gap) / 2);
      drawImageCover(ctx, shots[0], margin, usableTop, widthPx - margin * 2, slotH);
      drawImageCover(ctx, shots[1], margin, usableTop + slotH + gap, widthPx - margin * 2, slotH);
    } else {
      const bodyTop = usableTop + Math.round(usableHeight * 0.08);
      const bodyH = usableBottom - bodyTop;
      drawImageCover(ctx, shots[0], margin, bodyTop, widthPx - margin * 2, bodyH);
      if (!receiptMode) {
        ctx.fillStyle = "#181818";
        ctx.fillRect(margin, usableTop, widthPx - margin * 2, Math.round(Math.min(heightPx * 0.06, usableHeight * 0.18)));
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(heightPx * 0.032)}px Arial`;
        ctx.fillText(settings.eventTitle, margin + Math.round(widthPx * 0.02), usableTop + Math.round(Math.min(heightPx * 0.042, usableHeight * 0.15)));
      }
    }

    if (settings.showTimestamp) {
      ctx.fillStyle = "#222";
      ctx.font = `${Math.round(heightPx * 0.02)}px Arial`;
      const stamp = new Date().toLocaleString();
      ctx.fillText(stamp, margin, heightPx - Math.round(heightPx * 0.02));
    }

    return canvas;
  }

  function drawQrZone(ctx, widthPx, margin, zoneTop, zoneHeight) {
    const zoneW = widthPx - margin * 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(margin, zoneTop, zoneW, zoneHeight);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = Math.max(1, Math.round(widthPx * 0.002));
    ctx.strokeRect(margin, zoneTop, zoneW, zoneHeight);

    const pad = Math.round(zoneHeight * 0.12);
    const qrSize = Math.max(56, Math.min(zoneHeight - pad * 2, Math.round(zoneHeight * 0.76)));
    const qrCanvas = generateQrCanvas(settings.qrLink, qrSize);
    if (qrCanvas) {
      const qrX = margin + pad;
      const qrY = zoneTop + Math.round((zoneHeight - qrSize) / 2);
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    }

    ctx.fillStyle = "#222";
    ctx.font = `${Math.max(12, Math.round(zoneHeight * 0.14))}px Arial`;
    ctx.fillText("Scan for gallery", margin + pad + qrSize + Math.round(zoneW * 0.04), zoneTop + Math.round(zoneHeight * 0.45));
    ctx.font = `${Math.max(10, Math.round(zoneHeight * 0.11))}px Arial`;
    const shortLink = truncateText(settings.qrLink, 40);
    ctx.fillText(shortLink, margin + pad + qrSize + Math.round(zoneW * 0.04), zoneTop + Math.round(zoneHeight * 0.67));
  }

  function generateQrCanvas(text, size) {
    if (!text || typeof QRCode === "undefined") {
      return null;
    }
    const holder = document.createElement("div");
    new QRCode(holder, {
      text,
      width: size,
      height: size,
      correctLevel: QRCode.CorrectLevel.M
    });
    const img = holder.querySelector("img");
    const qrCanvas = holder.querySelector("canvas");
    if (qrCanvas) {
      return qrCanvas;
    }
    if (img) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const cctx = c.getContext("2d");
      // best-effort fallback
      cctx.drawImage(img, 0, 0, size, size);
      return c;
    }
    return null;
  }

  function drawImageCover(ctx, imageCanvas, x, y, w, h) {
    const sw = imageCanvas.width;
    const sh = imageCanvas.height;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(imageCanvas, dx, dy, dw, dh);
  }

  async function drawHeaderImageIfAny(ctx, widthPx, heightPx, margin, zoneHeight) {
    if (!settings.headerImageData) {
      return 0;
    }
    const img = await loadImage(settings.headerImageData);
    const h = zoneHeight;
    ctx.fillStyle = "#fff";
    ctx.fillRect(margin, margin, widthPx - margin * 2, h);
    drawImageContain(ctx, img, margin, margin, widthPx - margin * 2, h);
    return h;
  }

  async function drawFooterImageIfAny(ctx, widthPx, heightPx, margin, zoneHeight) {
    if (!settings.footerLogoData) {
      return 0;
    }
    const img = await loadImage(settings.footerLogoData);
    const h = zoneHeight;
    const y = heightPx - margin - h;
    ctx.fillStyle = "#fff";
    ctx.fillRect(margin, y, widthPx - margin * 2, h);
    drawImageContain(ctx, img, margin, y, widthPx - margin * 2, h);
    return h;
  }

  function drawImageContain(ctx, source, x, y, w, h) {
    const sw = source.width;
    const sh = source.height;
    const scale = Math.min(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image asset"));
      img.src = src;
    });
  }

  async function printCanvas(canvas, templateKey, userInitiated) {
    setPrintStatus("Preparing print...");
    const t = TEMPLATE_MAP[templateKey];
    const profile = normalizePrinterProfile(settings.printerProfile);
    const engine = normalizePrintEngine(settings.printEngine);
    const printAsset = profile === "receipt80"
      ? createReceiptPrintAsset(
        canvas,
        normalizeReceiptQuality(settings.receiptQuality),
        normalizeReceiptRenderMode(settings.receiptRenderMode),
        normalizeReceiptBrightness(settings.receiptBrightness),
        normalizeReceiptContrast(settings.receiptContrast)
      )
      : createPhotoPrintAsset(canvas, t);

    if (engine === "qz") {
      const ok = await tryQzPrint(printAsset, profile);
      if (ok) {
        setPrintStatus("QZ print sent.");
      } else {
        setPrintStatus("QZ unavailable. Falling back to browser print.");
      }
      if (ok) {
        return;
      }
    }
    const dataUrl = printAsset.dataUrl;
    const dims = toPortraitPage(printAsset.pageWidthCss, printAsset.pageHeightCss);
    const isReceipt = printAsset.mode === "receipt80";
    const finalHtml = `<!doctype html><html><head><meta charset="utf-8">
      <style>
      @page { size: ${dims.widthCss} ${dims.heightCss}; margin: 0; }
      html, body {
        margin:0; padding:0; background:#fff;
        width:${dims.widthCss};
        height:${dims.heightCss};
      }
      .sheet {
        width:${isReceipt ? dims.widthCss : printAsset.sheetWidthCss};
        height:${dims.heightCss};
        display:block;
        margin:0 auto;
        page-break-inside: avoid;
      }
      img {
        display:block;
        width:100%;
        height:100%;
        object-fit:${isReceipt ? "contain" : "fill"};
      }
      .pad {
        width:${isReceipt ? dims.widthCss : printAsset.sheetWidthCss};
        height:${dims.heightCss};
        margin: 0 auto;
      }
      </style></head>
      <body><div class="pad"><div class="sheet"><img src="${dataUrl}" alt="print"></div></div></body></html>`;
    const popupOpened = openPopupPrintWindow(finalHtml);
    if (popupOpened) {
      setPrintStatus("Print window opened.");
      return;
    }

    try {
      const iframePrinted = await printViaIframe(finalHtml);
      if (iframePrinted) {
        setPrintStatus("Print dialog opened.");
        return;
      }
    } catch {
      // continue to status handling below
    }

    if (!userInitiated) {
      setPrintStatus("Auto-print blocked. Tap Print button.");
      return;
    }
    setPrintStatus("Print blocked. Enable popups or use Ctrl+Shift+P.");
  }

  async function printViaIframe(finalHtml) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    const iframePromise = new Promise((resolve, reject) => {
      iframe.onload = () => {
        const w = iframe.contentWindow;
        const img = w.document.querySelector("img");
        if (!img) {
          iframe.remove();
          reject(new Error("Print frame image not found."));
          return;
        }
        const triggerPrint = () => {
          setTimeout(() => {
            try {
              let finished = false;
              const finalize = () => {
                if (finished) {
                  return;
                }
                finished = true;
                resolve(true);
                setTimeout(() => iframe.remove(), 10000);
              };
              try {
                w.addEventListener("afterprint", finalize, { once: true });
              } catch {
                // ignore unsupported afterprint binding
              }
              w.focus();
              w.print();
              setTimeout(finalize, 1200);
            } catch (error) {
              reject(error);
            }
          }, 80);
        };
        if (img.complete) {
          triggerPrint();
        } else {
          img.onload = triggerPrint;
          img.onerror = () => {
            iframe.remove();
            reject(new Error("Print image failed to load."));
          };
        }
      };
    });
    iframe.srcdoc = finalHtml;
    document.body.appendChild(iframe);
    try {
      await withTimeout(iframePromise, 12000);
      return true;
    } catch {
      return false;
    }
  }

  async function tryQzPrint(printAsset, profile) {
    if (typeof window.qz === "undefined") {
      return false;
    }
    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      const config = qz.configs.create(null, {
        copies: 1,
        colorType: "color",
        density: normalizeDpi(settings.printDpi)
      });

      if (profile === "receipt80") {
        const quality = normalizeReceiptQuality(settings.receiptQuality);
        const dotDensity = quality === "fast" ? "single" : "double";
        const data = [
          {
            type: "raw",
            format: "image",
            flavor: "base64",
            data: stripDataUrlPrefix(printAsset.dataUrl),
            options: { language: "ESCPOS", dotDensity }
          }
        ];
        if (settings.autoCut) {
          data.push("\x1D\x56\x00");
        }
        await qz.print(config, data);
      } else {
        const data = [{
          type: "pixel",
          format: "image",
          flavor: "base64",
          data: stripDataUrlPrefix(printAsset.dataUrl)
        }];
        await qz.print(config, data);
      }
      return true;
    } catch (error) {
      console.error("QZ print failed", error);
      return false;
    }
  }

  function openPopupPrintWindow(html) {
    try {
      const win = window.open("", "_blank", "width=420,height=780");
      if (!win) {
        return false;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            // ignored
          }
        }, 120);
      };
      return true;
    } catch {
      return false;
    }
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then((value) => {
        clearTimeout(id);
        resolve(value);
      }).catch((error) => {
        clearTimeout(id);
        reject(error);
      });
    });
  }

  function setPrintStatus(message) {
    ui.printStatus.textContent = message;
  }

  function stripDataUrlPrefix(dataUrl) {
    const idx = dataUrl.indexOf(",");
    return idx > -1 ? dataUrl.slice(idx + 1) : dataUrl;
  }

  function createPhotoPrintAsset(canvas, template) {
    return {
      mode: "photo",
      dataUrl: canvas.toDataURL("image/png"),
      pageWidthCss: `${template.widthIn}in`,
      pageHeightCss: `${template.heightIn}in`,
      sheetWidthCss: `${template.widthIn}in`,
      sheetHeightCss: `${template.heightIn}in`
    };
  }

  function createReceiptPrintAsset(canvas, quality, renderMode, brightness, contrastScale) {
    const receiptWidthMm = 80;
    const receiptPrintableMm = 72;
    const widthPx = quality === "fast" ? 384 : quality === "high" ? 576 : 512;
    const trimmed = trimNearWhiteBounds(canvas, 246);
    const source = trimmed || canvas;
    const ratio = Math.max(source.height / source.width, 1.25);
    const heightPx = Math.max(420, Math.round(widthPx * ratio));
    const out = document.createElement("canvas");
    out.width = widthPx;
    out.height = heightPx;
    const ctx = out.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = quality === "fast" ? "medium" : "high";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
    // Fill printable width using detected content bounds to avoid tiny output.
    const sidePad = Math.round(out.width * 0.03);
    const topPad = Math.round(out.height * 0.03);
    const drawW = out.width - sidePad * 2;
    const drawH = out.height - topPad * 2;
    drawImageContain(ctx, source, sidePad, topPad, drawW, drawH);
    applyThermalReceiptTone(out, quality, renderMode, brightness, contrastScale);

    const heightMm = Math.max(55, Math.round((heightPx / widthPx) * receiptPrintableMm));
    return {
      mode: "receipt80",
      dataUrl: out.toDataURL("image/png"),
      pageWidthCss: `${receiptWidthMm}mm`,
      pageHeightCss: `${heightMm}mm`,
      sheetWidthCss: `${receiptPrintableMm}mm`,
      sheetHeightCss: `${heightMm}mm`
    };
  }

  function runCountdown(startFrom) {
    return new Promise((resolve) => {
      let count = startFrom;
      ui.countdown.textContent = String(count);
      const timer = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(timer);
          ui.countdown.textContent = "";
          resolve();
        } else {
          ui.countdown.textContent = String(count);
        }
      }, 1000);
    });
  }

  function triggerFlash() {
    ui.flashLayer.classList.remove("flash");
    void ui.flashLayer.offsetWidth;
    ui.flashLayer.classList.add("flash");
  }

  function reviewShot(canvas) {
    return new Promise((resolve) => {
      currentReviewResolver = resolve;
      ui.reviewImage.src = canvas.toDataURL("image/jpeg", 0.95);
      showScreen("reviewScreen");
    });
  }

  function resolveReview(keep) {
    if (!currentReviewResolver) {
      return;
    }
    const resolver = currentReviewResolver;
    currentReviewResolver = null;
    showScreen("kioskScreen");
    resolver(keep);
  }

  function buildQrPreview() {
    if (!settings.qrEnabled || !settings.qrLink || typeof QRCode === "undefined") {
      ui.qrWrap.classList.add("hidden");
      ui.qrTarget.innerHTML = "";
      return;
    }
    ui.qrWrap.classList.remove("hidden");
    ui.qrTarget.innerHTML = "";
    new QRCode(ui.qrTarget, {
      text: settings.qrLink,
      width: 160,
      height: 160,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function hideControls(hidden) {
    const controls = document.querySelector(".controls");
    controls.style.opacity = hidden ? "0" : "1";
    controls.style.pointerEvents = hidden ? "none" : "auto";
  }

  function showScreen(id) {
    [ui.startScreen, ui.kioskScreen, ui.reviewScreen, ui.resultScreen].forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  function scheduleResultAutoReset() {
    if (resultAutoResetTimer) {
      clearTimeout(resultAutoResetTimer);
    }
    resultAutoResetTimer = setTimeout(() => {
      resetToStart();
    }, 30000);
  }

  function resetToStart() {
    if (resultAutoResetTimer) {
      clearTimeout(resultAutoResetTimer);
      resultAutoResetTimer = null;
    }
    sessionShots = [];
    composedCanvas = null;
    composedTemplateKey = ui.templateSelect.value || "strip";
    showScreen("startScreen");
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function normalizeDpi(value) {
    const n = Number(value);
    if (n === 124 || n === 324) {
      return n;
    }
    return 300;
  }

  function normalizeTemplateKey(value) {
    if (value === "strip" || value === "grid" || value === "polaroid" || value === "double") {
      return value;
    }
    return "strip";
  }

  function normalizePrinterProfile(value) {
    return value === "receipt80" ? "receipt80" : "photo";
  }

  function normalizePrintEngine(value) {
    return value === "qz" ? "qz" : "browser";
  }

  function normalizeReceiptQuality(value) {
    if (value === "fast" || value === "high") {
      return value;
    }
    return "balanced";
  }

  function normalizeReceiptRenderMode(value) {
    return value === "bw" ? "bw" : "grayscale";
  }

  function normalizeReceiptBrightness(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return 12;
    }
    return Math.min(60, Math.max(-40, Math.round(n)));
  }

  function normalizeReceiptContrast(value) {
    const n = Number(value);
    if (Number.isNaN(n)) {
      return 1.0;
    }
    return Math.min(1.4, Math.max(0.7, Math.round(n * 100) / 100));
  }

  function normalizeFilterMode(value) {
    if (value === "mono" || value === "silvertone" || value === "noir") {
      return value;
    }
    return "none";
  }

  function applySelectedFilter(canvas) {
    const mode = normalizeFilterMode(settings.filterMode);
    if (mode === "mono") {
      applyMonoTone(canvas);
    } else if (mode === "silvertone") {
      applySilverTone(canvas);
    } else if (mode === "noir") {
      applyNoirTone(canvas);
    }
  }

  function applyMonoTone(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const balanced = (lum - 128) * 1.04 + 128;
      const v = clamp(balanced, 0, 255);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  function applySilverTone(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.21 * r + 0.72 * g + 0.07 * b;
      const soft = Math.pow(lum / 255, 0.96) * 255;
      const gentle = (soft - 128) * 0.95 + 128;
      const base = clamp(gentle, 0, 255);
      d[i] = clamp(base + 9, 0, 255);
      d[i + 1] = clamp(base + 4, 0, 255);
      d[i + 2] = clamp(base - 2, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  function applyNoirTone(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const gammaLift = Math.pow(lum / 255, 0.86) * 255;
      const highContrast = (gammaLift - 128) * 1.55 + 128;
      const deepBlack = highContrast < 46 ? highContrast * 0.65 : highContrast;
      const v = clamp(deepBlack, 0, 255);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function applyThermalSharpen(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const dst = ctx.getImageData(0, 0, w, h);
    const s = src.data;
    const d = dst.data;
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let acc = 0;
        let i = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const p = ((y + ky) * w + (x + kx)) * 4;
            acc += s[p] * k[i++];
          }
        }
        const idx = (y * w + x) * 4;
        const v = clamp(acc, 0, 255);
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
      }
    }
    ctx.putImageData(dst, 0, 0);
  }

  function applyThermalReceiptTone(canvas, quality, renderMode, brightness, contrastScale) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const baseContrast = quality === "fast" ? 0.86 : quality === "high" ? 0.98 : 0.9;
    const contrast = baseContrast * contrastScale;
    const bayer4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];

    let totalLum = 0;
    const pixelCount = canvas.width * canvas.height;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      totalLum += lum;
    }
    const avgLum = totalLum / Math.max(1, pixelCount);
    const exposureLift = avgLum < 118 ? 22 : avgLum < 138 ? 14 : 8;
    const baseThreshold = quality === "fast" ? 178 : quality === "high" ? 168 : 174;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // Lift midtones to avoid crushed blacks on thermal stock.
        const gamma = Math.pow(lum / 255, 1.0) * 255;
        const boosted = clamp((gamma - 128) * contrast + 136 + exposureLift + brightness, 0, 255);
        if (renderMode === "grayscale") {
          const tone = Math.round(boosted);
          d[i] = tone;
          d[i + 1] = tone;
          d[i + 2] = tone;
          continue;
        }
        const m = bayer4[y % 4][x % 4];
        const t = baseThreshold + (m - 7.5) * 0.8;
        const out = boosted < t ? 0 : 255;
        d[i] = out;
        d[i + 1] = out;
        d[i + 2] = out;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function trimNearWhiteBounds(sourceCanvas, whiteThreshold) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const r = img[i];
        const g = img[i + 1];
        const b = img[i + 2];
        if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return null;
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = boxW;
    out.height = boxH;
    const octx = out.getContext("2d", { alpha: false });
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, boxW, boxH);
    octx.drawImage(sourceCanvas, minX, minY, boxW, boxH, 0, 0, boxW, boxH);
    return out;
  }

  function toPortraitPage(widthCss, heightCss) {
    const w = parseCssLength(widthCss);
    const h = parseCssLength(heightCss);
    if (w.unit !== h.unit) {
      return { widthCss, heightCss };
    }
    if (w.value <= h.value) {
      return { widthCss, heightCss };
    }
    return {
      widthCss: `${h.value}${h.unit}`,
      heightCss: `${w.value}${w.unit}`
    };
  }

  function parseCssLength(cssLength) {
    const match = String(cssLength).trim().match(/^([0-9]*\.?[0-9]+)([a-z%]+)$/i);
    if (!match) {
      return { value: 0, unit: "px" };
    }
    return { value: Number(match[1]), unit: match[2].toLowerCase() };
  }

  function truncateText(text, max) {
    const s = String(text || "");
    if (s.length <= max) {
      return s;
    }
    return `${s.slice(0, max - 1)}…`;
  }

  function loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function appendSessionLog(template, shotCount) {
    const logs = loadLogs();
    logs.push({
      id: `session_${Date.now()}`,
      template,
      shotCount,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  }

  async function enterFullscreen() {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) {
      return;
    }
    try {
      await root.requestFullscreen();
    } catch {
      // Fullscreen may be blocked on some iOS versions.
    }
  }

  function byId(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Missing required element: ${id}`);
    }
    return el;
  }
})();
