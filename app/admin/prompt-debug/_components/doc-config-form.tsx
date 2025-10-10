'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DomainId } from '@/lib/domains';
import type { DocumentType } from '@/lib/artifacts';
import { DOMAINS } from '@/lib/domains';
import { METADATA_FIELD_LABELS } from '@/lib/artifacts/metadata-schemas';

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
      case 'sales-call-summary':
        return (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="callDate">{METADATA_FIELD_LABELS.callDate}</Label>
              <Input
                id="callDate"
                type="date"
                value={config.metadata.callDate || '2025-01-15'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: { ...config.metadata, callDate: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participants">
                {METADATA_FIELD_LABELS.participants}
              </Label>
              <Input
                id="participants"
                value={
                  Array.isArray(config.metadata.participants)
                    ? config.metadata.participants.join(', ')
                    : ''
                }
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: {
                      ...config.metadata,
                      participants: e.target.value
                        .split(',')
                        .map((p) => p.trim()),
                    },
                  })
                }
                placeholder="John, Sarah, Mike"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dealName">{METADATA_FIELD_LABELS.dealName}</Label>
              <Input
                id="dealName"
                value={config.metadata.dealName || 'Acme Corp Enterprise'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: { ...config.metadata, dealName: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospectCompany">
                {METADATA_FIELD_LABELS.prospectCompany}
              </Label>
              <Input
                id="prospectCompany"
                value={config.metadata.prospectCompany || 'Acme Corporation'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: {
                      ...config.metadata,
                      prospectCompany: e.target.value,
                    },
                  })
                }
              />
            </div>
          </>
        );

      case 'meeting-analysis':
      case 'meeting-minutes':
        return (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="meetingDate">
                {METADATA_FIELD_LABELS.meetingDate}
              </Label>
              <Input
                id="meetingDate"
                type="date"
                value={
                  config.metadata.meetingDate ||
                  new Date().toISOString().split('T')[0]
                }
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: {
                      ...config.metadata,
                      meetingDate: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participants">
                {METADATA_FIELD_LABELS.participants}
              </Label>
              <Input
                id="participants"
                value={
                  Array.isArray(config.metadata.participants)
                    ? config.metadata.participants.join(', ')
                    : ''
                }
                onChange={(e) =>
                  onChange({
                    ...config,
                    metadata: {
                      ...config.metadata,
                      participants: e.target.value
                        .split(',')
                        .map((p) => p.trim()),
                    },
                  })
                }
                placeholder="Team members"
              />
            </div>
            {config.documentType === 'meeting-minutes' && (
              <div className="space-y-1.5">
                <Label htmlFor="emailRecipients">
                  {METADATA_FIELD_LABELS.emailRecipients}
                </Label>
                <Input
                  id="emailRecipients"
                  value={
                    Array.isArray(config.metadata.emailRecipients)
                      ? config.metadata.emailRecipients.join(', ')
                      : ''
                  }
                  onChange={(e) =>
                    onChange({
                      ...config,
                      metadata: {
                        ...config.metadata,
                        emailRecipients: e.target.value
                          .split(',')
                          .map((p) => p.trim()),
                      },
                    })
                  }
                  placeholder="email@example.com"
                />
              </div>
            )}
          </>
        );

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
