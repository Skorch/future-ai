import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the schema from the PlaybookForm component for testing
const playbookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  whenToUse: z.string().optional(),
  domains: z.array(z.string()).min(1, 'At least one domain is required'),
  steps: z
    .array(
      z.object({
        id: z.string(),
        instruction: z.string().min(1, 'Step instruction cannot be empty'),
      }),
    )
    .min(1, 'At least one step is required'),
});

describe('Playbook Form Validation', () => {
  describe('name field', () => {
    it('should accept valid name', () => {
      const data = {
        name: 'bant-validation',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name is required');
      }
    });

    it('should reject missing name', () => {
      const data = {
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept name with special characters', () => {
      const data = {
        name: 'bant-validation_v2.0',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('description field', () => {
    it('should be optional', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept description when provided', () => {
      const data = {
        name: 'test-playbook',
        description: 'This is a test playbook',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept empty string description', () => {
      const data = {
        name: 'test-playbook',
        description: '',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('whenToUse field', () => {
    it('should be optional', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept whenToUse when provided', () => {
      const data = {
        name: 'test-playbook',
        whenToUse: 'Use when analyzing sales calls',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('domains field', () => {
    it('should accept single domain', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept multiple domains', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales', 'meeting'],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty domains array', () => {
      const data = {
        name: 'test-playbook',
        domains: [],
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'At least one domain is required',
        );
      }
    });

    it('should reject missing domains', () => {
      const data = {
        name: 'test-playbook',
        steps: [{ id: '1', instruction: 'Step 1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('steps field', () => {
    it('should accept single step', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: 'step-1', instruction: 'First step' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept multiple steps', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [
          { id: 'step-1', instruction: 'First step' },
          { id: 'step-2', instruction: 'Second step' },
          { id: 'step-3', instruction: 'Third step' },
        ],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty steps array', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'At least one step is required',
        );
      }
    });

    it('should reject step with empty instruction', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: 'step-1', instruction: '' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Step instruction cannot be empty',
        );
      }
    });

    it('should reject step with missing instruction', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ id: 'step-1' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject step with missing id', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [{ instruction: 'Step without id' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept steps with markdown instructions', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [
          {
            id: 'step-1',
            instruction: '**Bold text** and *italic text* with [links](url)',
          },
        ],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept steps with multiline instructions', () => {
      const data = {
        name: 'test-playbook',
        domains: ['sales'],
        steps: [
          {
            id: 'step-1',
            instruction: `Line 1
Line 2
Line 3`,
          },
        ],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('complete form validation', () => {
    it('should accept fully populated valid playbook', () => {
      const data = {
        name: 'bant-validation',
        description: 'Validate Budget, Authority, Need, Timeline, Competition',
        whenToUse: 'Use when analyzing sales call transcripts',
        domains: ['sales'],
        steps: [
          { id: '1', instruction: 'Extract BANT-C facts' },
          { id: '2', instruction: 'Create validation checklist' },
          { id: '3', instruction: 'Validate with user' },
          { id: '4', instruction: 'Consolidate findings' },
          { id: '5', instruction: 'Transition to build mode' },
        ],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept minimal valid playbook', () => {
      const data = {
        name: 'minimal',
        domains: ['meeting'],
        steps: [{ id: '1', instruction: 'Do something' }],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject completely invalid playbook', () => {
      const data = {
        name: '',
        domains: [],
        steps: [],
      };

      const result = playbookSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });
  });
});
