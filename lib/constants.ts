export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

// Large paste configuration
export const LARGE_PASTE_THRESHOLD = 3000; // characters
export const PASTE_SUGGESTION_TIMEOUT = 7000; // milliseconds
