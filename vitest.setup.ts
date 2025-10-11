// Mock server-only module to prevent errors in tests
// This allows us to test server-only code in a test environment
import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import * as React from 'react';

// Make React available globally for JSX transform
// This is needed for components that don't explicitly import React
(globalThis as { React?: typeof React }).React = React;

vi.mock('server-only', () => ({}));
