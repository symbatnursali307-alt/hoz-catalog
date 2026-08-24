(function () {
  window.__catalogPwaInstallPrompt = window.__catalogPwaInstallPrompt || null;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__catalogPwaInstallPrompt = event;
    window.dispatchEvent(new Event('catalog:pwa-install-ready'));
  });

  window.addEventListener('appinstalled', function () {
    window.__catalogPwaInstallPrompt = null;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
  }
})();
