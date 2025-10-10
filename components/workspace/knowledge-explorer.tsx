'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchIcon } from 'lucide-react';
import { KnowledgeCard } from './knowledge-card';
import type { KnowledgeDocument } from '@/lib/db/knowledge-document';

interface KnowledgeExplorerProps {
  workspaceId: string;
  documents: KnowledgeDocument[];
  category: 'knowledge' | 'raw';
}

export function KnowledgeExplorer({
  workspaceId,
  documents,
  category,
}: KnowledgeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');

  // Get unique document types
  const documentTypes = useMemo(() => {
    const types = new Set(documents.map((doc) => doc.documentType));
    return Array.from(types);
  }, [documents]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        documentTypeFilter === 'all' || doc.documentType === documentTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, documentTypeFilter]);

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-semibold mb-2">
          No {category} documents yet
        </h3>
        <p className="text-muted-foreground">
          {category === 'knowledge'
            ? 'Knowledge documents will appear here as you create summaries and analyses'
            : 'Upload transcripts to get started'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {documentTypes.length > 1 && (
          <Select
            value={documentTypeFilter}
            onValueChange={setDocumentTypeFilter}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {documentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results */}
      <div className="space-y-2">
        {filteredDocuments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No documents match your filters
          </p>
        ) : (
          filteredDocuments.map((doc) => (
            <KnowledgeCard
              key={doc.id}
              document={doc}
              workspaceId={workspaceId}
            />
          ))
        )}
      </div>
    </div>
  );
}
