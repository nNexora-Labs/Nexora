import createCache from '@emotion/cache';

// Create emotion cache for Material-UI
export const createEmotionCache = () => {
  return createCache({ key: 'css', prepend: true });
};

// Client-side cache
export const clientSideEmotionCache = createEmotionCache();

