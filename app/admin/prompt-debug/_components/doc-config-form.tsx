'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DomainId } from '@/lib/domains';
import type { DocumentType } from '@/lib/artifacts';
import { DOMAINS } from '@/lib/domains';

export interface DocConfig {
  domain: DomainId;
  documentType: DocumentType;
  agentInstruction: string;
  // biome-ignore lint/suspicious/noExplicitAny: Metadata values can be of any type
  metadata: Record<string, any>;
}

interface DocConfigFormProps {
  config: DocConfig;
  onChange: (config: DocConfig) => void;
}

export function DocConfigForm({ config, onChange }: DocConfigFormProps) {
  const domain = DOMAINS[config.domain];
  const allowedTypes = domain.allowedTypes;

  // Render metadata fields based on document type
  const renderMetadataFields = () => {
    switch (config.documentType) {
      default:
        return (
          <p className="text-sm text-muted-foreground">No metadata required</p>
        );
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Configuration</h3>

      {/* Domain Selection */}
      <div className="space-y-2">
        <Label>Domain</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="doc-domain"
              value="sales"
              checked={config.domain === 'sales'}
              onChange={(e) => {
                const newDomain = e.target.value as DomainId;
                const newAllowedTypes = DOMAINS[newDomain].allowedTypes;
                onChange({
                  ...config,
                  domain: newDomain,
                  documentType: newAllowedTypes[0],
                  metadata: {},
                });
              }}
              className="size-4"
            />
            <span>Sales</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="doc-domain"
              value="meeting"
              checked={config.domain === 'project'}
              onChange={(e) => {
                const newDomain = e.target.value as DomainId;
                const newAllowedTypes = DOMAINS[newDomain].allowedTypes;
                onChange({
                  ...config,
                  domain: newDomain,
                  documentType: newAllowedTypes[0],
                  metadata: {},
                });
              }}
              className="size-4"
            />
            <span>Meeting</span>
          </label>
        </div>
      </div>

      {/* Document Type Selection */}
      <div className="space-y-1.5">
        <Label htmlFor="docType">Document Type</Label>
        <select
          id="docType"
          value={config.documentType}
          onChange={(e) =>
            onChange({
              ...config,
              documentType: e.target.value as DocumentType,
              metadata: {}, // Reset metadata when type changes
            })
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2"
        >
          {allowedTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Agent Instruction */}
      <div className="space-y-1.5">
        <Label htmlFor="agentInstruction">Agent Instruction</Label>
        <Textarea
          id="agentInstruction"
          value={config.agentInstruction}
          onChange={(e) =>
            onChange({ ...config, agentInstruction: e.target.value })
          }
          placeholder="Focus on technical requirements and budget discussions"
          rows={3}
        />
      </div>

      {/* Metadata Fields */}
      <div className="space-y-3 border-t pt-3">
        <h4 className="text-sm font-medium">
          Metadata ({config.documentType})
        </h4>
        {renderMetadataFields()}
      </div>
    </div>
  );
}
