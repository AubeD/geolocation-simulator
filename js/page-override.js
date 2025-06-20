// page-override.js injected as external script when page CSP blocks inline scripts
(function overrideGeolocation() {
  let latestPosition = {
    coords: { latitude: 0, longitude: 0, accuracy: 10 },
    timestamp: Date.now(),
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.type === 'GS_SET_POSITION') {
      latestPosition = {
        coords: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy ?? 10,
        },
        timestamp: Date.now(),
      };
    }
  });

  navigator.geolocation.getCurrentPosition = function (success) {
    if (typeof success === 'function') queueMicrotask(() => success(latestPosition));
  };

  const watchCallbacks = new Map();
  let watchIdCounter = 1;
  navigator.geolocation.watchPosition = function (success) {
    const id = watchIdCounter++;
    watchCallbacks.set(id, success);
    if (typeof success === 'function') queueMicrotask(() => success(latestPosition));
    return id;
  };
  navigator.geolocation.clearWatch = function (id) {
    watchCallbacks.delete(id);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.type === 'GS_SET_POSITION') {
      watchCallbacks.forEach((cb) => {
        if (typeof cb === 'function') queueMicrotask(() => cb(latestPosition));
      });
    }
  });
})();
