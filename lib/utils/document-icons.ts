import {
  FileText,
  FileCheck,
  Calendar,
  Mail,
  BarChart3,
  Lightbulb,
  Mic,
  Handshake,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon mapping for document types
 * Maps document type strings to their corresponding Lucide icon components
 *
 * NOTE: This mapping must stay in sync with the icon fields in
 * the metadata.ts files under lib/artifacts/document-types/
 *
 * To update:
 * 1. Add icon field to metadata.ts for new document type
 * 2. Import the icon from lucide-react above
 * 3. Add mapping entry below
 */
const DOCUMENT_ICON_MAP: Record<string, LucideIcon> = {
  text: FileText,
  'business-requirements': FileCheck,
  'meeting-agenda': Calendar,
  'meeting-minutes': Mail,
  'meeting-analysis': BarChart3,
  'use-case': Lightbulb,
  'sales-call-summary': Handshake,
  transcript: Mic, // Special case: not in artifact registry
};

/**
 * Get the icon component for a document type
 * Falls back to FileText if type is unknown
 *
 * This is a pure client-side function and does not import from artifact registry
 * to avoid pulling in server-only code.
 */
export function getDocumentIcon(documentType: string): LucideIcon {
  return DOCUMENT_ICON_MAP[documentType] || FileText;
}
