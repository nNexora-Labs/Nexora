// Global polyfill for browser environment
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

// Additional polyfills for Node.js modules that might be needed
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (callback: () => void) => setTimeout(callback, 0),
  };
}
