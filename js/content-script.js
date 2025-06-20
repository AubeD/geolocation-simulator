// content-script.js
// Injects an override for navigator.geolocation into the page context and
// receives updated mock positions from the extension.

(function () {
  /**
   * Code that runs inside the page context. It overrides the Geolocation API.
   */
  function overrideGeolocation() {
    // Store the latest position to be returned.
    let latestPosition = {
      coords: {
        latitude: 0,
        longitude: 0,
        accuracy: 10,
      },
      timestamp: Date.now(),
    };

    // Listen for position updates coming from the content script via postMessage.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data && data.type === "GS_SET_POSITION") {
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

    // Override getCurrentPosition.
    navigator.geolocation.getCurrentPosition = function (success, error, options) {
      if (typeof success === "function") {
        queueMicrotask(() => success(latestPosition));
      }
    };

    // Maintain a simple watch list.
    const watchCallbacks = new Map();
    let watchIdCounter = 1;

    navigator.geolocation.watchPosition = function (success, error, options) {
      const id = watchIdCounter++;
      watchCallbacks.set(id, success);
      // Immediately invoke with the current position.
      if (typeof success === "function") queueMicrotask(() => success(latestPosition));
      return id;
    };

    navigator.geolocation.clearWatch = function (id) {
      watchCallbacks.delete(id);
    };

    // Whenever position updates, notify all watchers.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data && data.type === "GS_SET_POSITION") {
        watchCallbacks.forEach((cb) => {
          if (typeof cb === "function") queueMicrotask(() => cb(latestPosition));
        });
      }
    });
  }

  // Inject the override code into the page context.
  function inject(fn) {
    const script = document.createElement("script");
    script.textContent = "(" + fn.toString() + ")();";
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // Try inline injection first
inject(overrideGeolocation);

// If CSP blocks inline scripts, the override won't be installed.
// Detect quickly and fall back to an external script loaded from the extension.
if (navigator.geolocation && navigator.geolocation.getCurrentPosition.toString().includes('[native code]')) {
  const extUrl = chrome.runtime.getURL('js/page-override.js');
  const s = document.createElement('script');
  s.src = extUrl;
  (document.head || document.documentElement).appendChild(s);
  // script tag remains; external scripts are allowed under CSP for extensions
}

  // Listen for messages from the background script and forward them to the page.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "mockLocationUpdate") {
      window.postMessage(
        {
          type: "GS_SET_POSITION",
          latitude: msg.latitude,
          longitude: msg.longitude,
          accuracy: msg.accuracy,
        },
        "*"
      );
    }
  });
})();
