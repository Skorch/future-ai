// Output size configuration for document generation
export enum OutputSize {
  SMALL = 1500, // Brief summaries, quick notes
  MEDIUM = 2500, // Standard documents like meeting memories
  LARGE = 4000, // Comprehensive reports, detailed analysis
  XLARGE = 8000, // Full documentation, extensive content
}

// Thinking budget configuration for AI generation
export enum ThinkingBudget {
  NONE = 0, // No thinking process
  LOW = 4000, // Quick analysis
  MEDIUM = 8000, // Standard analysis for complex documents
  HIGH = 12000, // Deep analysis for critical documents
}
