'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Scenario } from '../types';
import type { Domain, ArtifactType } from '@/lib/db/schema';

interface ConfigurationPanelProps {
  scenario: Scenario;
  domains: Domain[];
  artifactTypes: ArtifactType[];
  selectedDomainId: string | null;
  selectedArtifactTypeId: string | null;
  onDomainChange: (domainId: string) => void;
  onArtifactTypeChange: (artifactTypeId: string) => void;
}

export function ConfigurationPanel({
  scenario,
  domains,
  artifactTypes,
  selectedDomainId,
  selectedArtifactTypeId,
  onDomainChange,
  onArtifactTypeChange,
}: ConfigurationPanelProps) {
  // Filter artifact types by category if scenario requires it
  const filteredArtifactTypes = scenario.artifactCategory
    ? artifactTypes.filter((at) => at.category === scenario.artifactCategory)
    : artifactTypes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenario.requiresDomain && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Domain</div>
            <Select
              value={selectedDomainId || ''}
              onValueChange={onDomainChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select domain..." />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {scenario.requiresArtifactType && (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Artifact Type
              {scenario.artifactCategory && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (Category: {scenario.artifactCategory})
                </span>
              )}
            </div>
            <Select
              value={selectedArtifactTypeId || ''}
              onValueChange={onArtifactTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select artifact type..." />
              </SelectTrigger>
              <SelectContent>
                {filteredArtifactTypes.map((artifactType) => (
                  <SelectItem key={artifactType.id} value={artifactType.id}>
                    <div className="flex flex-col">
                      <span>{artifactType.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {artifactType.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!scenario.requiresDomain && !scenario.requiresArtifactType && (
          <p className="text-sm text-muted-foreground">
            No configuration needed for this scenario.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
