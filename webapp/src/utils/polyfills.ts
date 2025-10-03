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

// WASM polyfills for FHE SDK
if (typeof window !== 'undefined') {
  // Ensure WebAssembly is available
  if (typeof WebAssembly === 'undefined') {
    console.error('WebAssembly is not supported in this browser');
  }
  
  // Add crypto polyfill if needed
  if (!window.crypto) {
    console.warn('Crypto API not available, some FHE operations may fail');
  }
  
  // Ensure proper memory management for WASM
  if (!(window as any).__wbindgen_malloc) {
    // This will be provided by the WASM module when it loads
    console.log('Waiting for WASM module to provide memory management functions...');
  }
}
