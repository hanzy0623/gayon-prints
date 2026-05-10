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

  const ui = {
    eventTitleInput: byId("eventTitleInput"),
    eventSubtitleInput: byId("eventSubtitleInput"),
    fontSelect: byId("fontSelect"),
    headerStyleSelect: byId("headerStyleSelect"),
    autoPrintToggle: byId("autoPrintToggle"),
    timestampToggle: byId("timestampToggle"),
    qrEnabledToggle: byId("qrEnabledToggle"),
    qrLinkInput: byId("qrLinkInput"),
    defaultTemplateSelect: byId("defaultTemplateSelect"),
    printDpiSelect: byId("printDpiSelect"),
    printerProfileSelect: byId("printerProfileSelect"),
    printEngineSelect: byId("printEngineSelect"),
    autoCutToggle: byId("autoCutToggle"),
    receiptQualitySelect: byId("receiptQualitySelect"),
    receiptRenderModeSelect: byId("receiptRenderModeSelect"),
    receiptBrightnessInput: byId("receiptBrightnessInput"),
    receiptContrastInput: byId("receiptContrastInput"),
    filterModeSelect: byId("filterModeSelect"),
    headerImageInput: byId("headerImageInput"),
    footerLogoInput: byId("footerLogoInput"),
    saveSettingsBtn: byId("saveSettingsBtn"),
    resetEventBtn: byId("resetEventBtn"),
    saveStatus: byId("saveStatus")
  };

  let settings = loadSettings();

  init();

  function init() {
    fillForm();
    bindEvents();
  }

  function bindEvents() {
    ui.saveSettingsBtn.addEventListener("click", async () => {
      ui.saveSettingsBtn.disabled = true;
      try {
        settings.eventTitle = sanitizeText(ui.eventTitleInput.value, 80);
        settings.eventSubtitle = sanitizeText(ui.eventSubtitleInput.value, 120);
        settings.liveBranding = settings.eventSubtitle || "Premium Prints";
        settings.fontFamily = ui.fontSelect.value || DEFAULT_SETTINGS.fontFamily;
        settings.headerStyle = ui.headerStyleSelect.value || DEFAULT_SETTINGS.headerStyle;
        settings.autoPrint = ui.autoPrintToggle.checked;
        settings.showTimestamp = ui.timestampToggle.checked;
        settings.qrEnabled = ui.qrEnabledToggle.checked;
        settings.qrLink = sanitizeUrl(ui.qrLinkInput.value);
        settings.defaultTemplate = ui.defaultTemplateSelect.value || DEFAULT_SETTINGS.defaultTemplate;
        settings.printDpi = normalizeDpi(ui.printDpiSelect.value);
        settings.printerProfile = normalizePrinterProfile(ui.printerProfileSelect.value);
        settings.printEngine = normalizePrintEngine(ui.printEngineSelect.value);
        settings.autoCut = Boolean(ui.autoCutToggle.checked);
        settings.receiptQuality = normalizeReceiptQuality(ui.receiptQualitySelect.value);
        settings.receiptRenderMode = normalizeReceiptRenderMode(ui.receiptRenderModeSelect.value);
        settings.receiptBrightness = normalizeReceiptBrightness(ui.receiptBrightnessInput.value);
        settings.receiptContrast = normalizeReceiptContrast(ui.receiptContrastInput.value);
        settings.filterMode = normalizeFilterMode(ui.filterModeSelect.value);
        settings.headerImageData = await maybeReadImageAsDataUrl(ui.headerImageInput, settings.headerImageData);
        settings.footerLogoData = await maybeReadImageAsDataUrl(ui.footerLogoInput, settings.footerLogoData);

        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setStatus("Settings saved.");
      } catch (error) {
        console.error(error);
        setStatus("Failed to save settings.");
      } finally {
        ui.saveSettingsBtn.disabled = false;
      }
    });

    ui.resetEventBtn.addEventListener("click", () => {
      const yes = window.confirm("Reset all session logs and counters for this event?");
      if (!yes) {
        return;
      }
      localStorage.setItem(LOGS_KEY, "[]");
      setStatus("Event logs reset.");
    });
  }

  function fillForm() {
    ui.eventTitleInput.value = settings.eventTitle;
    ui.eventSubtitleInput.value = settings.eventSubtitle;
    ui.fontSelect.value = settings.fontFamily;
    ui.headerStyleSelect.value = settings.headerStyle;
    ui.autoPrintToggle.checked = Boolean(settings.autoPrint);
    ui.timestampToggle.checked = Boolean(settings.showTimestamp);
    ui.qrEnabledToggle.checked = Boolean(settings.qrEnabled);
    ui.qrLinkInput.value = settings.qrLink;
    ui.defaultTemplateSelect.value = settings.defaultTemplate;
    ui.printDpiSelect.value = String(normalizeDpi(settings.printDpi));
    ui.printerProfileSelect.value = normalizePrinterProfile(settings.printerProfile);
    ui.printEngineSelect.value = normalizePrintEngine(settings.printEngine);
    ui.autoCutToggle.checked = Boolean(settings.autoCut);
    ui.receiptQualitySelect.value = normalizeReceiptQuality(settings.receiptQuality);
    ui.receiptRenderModeSelect.value = normalizeReceiptRenderMode(settings.receiptRenderMode);
    ui.receiptBrightnessInput.value = String(normalizeReceiptBrightness(settings.receiptBrightness));
    ui.receiptContrastInput.value = String(normalizeReceiptContrast(settings.receiptContrast));
    ui.filterModeSelect.value = normalizeFilterMode(settings.filterMode);
  }

  async function maybeReadImageAsDataUrl(input, previousValue) {
    const file = input.files && input.files[0];
    if (!file) {
      return previousValue || "";
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("Uploaded file is not an image.");
    }
    return readFileAsDataUrl(file);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        resolve(result);
      };
      reader.readAsDataURL(file);
    });
  }

  function setStatus(message) {
    ui.saveStatus.textContent = message;
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

  function sanitizeText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function sanitizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.toString();
    } catch {
      return "";
    }
  }

  function normalizeDpi(value) {
    const n = Number(value);
    if (n === 124 || n === 324) {
      return n;
    }
    return 300;
  }

  function normalizePrinterProfile(value) {
    return value === "receipt80" ? "receipt80" : "photo";
  }

  function normalizeFilterMode(value) {
    if (value === "mono" || value === "silvertone" || value === "noir") {
      return value;
    }
    return "none";
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

  function byId(id) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Missing required element: ${id}`);
    }
    return el;
  }
})();
