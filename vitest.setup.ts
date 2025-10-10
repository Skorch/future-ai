// Mock server-only module to prevent errors in tests
// This allows us to test server-only code in a test environment
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
