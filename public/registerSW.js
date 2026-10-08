// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(registration) {
        console.log('[PWA] Service Worker aktif dengan scope:', registration.scope);
      })
      .catch(function(error) {
        console.warn('[PWA] Gagal mendaftarkan Service Worker:', error);
      });
  });
}
