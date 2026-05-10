export const appState = {
  photos: [],
  running: false,
  currentTemplate: 'strip',
  settings: {
    event: 'Gayon Prints',
    names: '',
    font: "'Space Mono', monospace",
    headerStyle: 'event',
    timestamp: false,
    autoPrint: false,
    qrLink: '',
    paperSize: 80,
    printQuality: 'normal',
    printCopies: 1,
    printerType: 'thermal'
  }
};

const STORAGE_KEY = 'booth';

export function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appState.settings = { ...appState.settings, ...parsed };
    } catch (error) {
      console.error('Failed to parse stored settings', error);
    }
  }
}

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.settings));
}
