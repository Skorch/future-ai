'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AgentConfigForm,
  type AgentConfig,
} from './_components/agent-config-form';
import { DocConfigForm, type DocConfig } from './_components/doc-config-form';
import { PromptPreview } from './_components/prompt-preview';
import { StreamConfigDisplay } from './_components/stream-config-display';
import { ToolsDisplay } from './_components/tools-display';
import type {
  MainAgentPromptResult,
  DocGenPromptResult,
} from '@/lib/ai/prompts/assemblers';
import { Copy } from 'lucide-react';
import { getDefaultMetadata } from '@/lib/artifacts/metadata-schemas';
import { getLogger } from '@/lib/logger';

const logger = getLogger('prompt-debug');

export default function PromptDebugPage() {
  const [activeTab, setActiveTab] = useState('agent');
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    domain: 'sales',
    mode: 'build',
    isComplete: false,
    goal: 'Analyze Q4 pipeline health',
    messageCount: 5,
    todoCount: 3,
  });

  const [docConfig, setDocConfig] = useState<DocConfig>({
    domain: 'sales',
    documentType: 'sales-analysis',
    agentInstruction: 'Focus on technical requirements and budget discussions',
    metadata: {
      ...getDefaultMetadata('sales-analysis'),
      callDate: '2025-01-15',
      participants: ['John', 'Sarah', 'Mike'],
      dealName: 'Acme Corp Enterprise',
      prospectCompany: 'Acme Corporation',
    },
  });

  const [agentPrompt, setAgentPrompt] = useState<MainAgentPromptResult | null>(
    null,
  );
  const [docPrompt, setDocPrompt] = useState<DocGenPromptResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch agent prompt when config changes
  useEffect(() => {
    const fetchAgentPrompt = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/prompt-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'agent',
            ...agentConfig,
            modeContext: {
              currentMode: agentConfig.mode,
              goal: agentConfig.goal,
              todoList: Array.from(
                { length: agentConfig.todoCount },
                (_, i) => ({
                  id: `todo-${i}`,
                  content: `Todo item ${i + 1}`,
                  status: 'pending',
                }),
              ),
              messageCount: agentConfig.messageCount,
              modeSetAt: new Date(),
            },
          }),
        });
        const data = await response.json();
        setAgentPrompt(data);
      } catch (error) {
        logger.error('Failed to fetch agent prompt', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentPrompt();
  }, [agentConfig]);

  // Fetch doc prompt when config changes
  useEffect(() => {
    const fetchDocPrompt = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/prompt-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'doc',
            ...docConfig,
          }),
        });
        const data = await response.json();
        setDocPrompt(data);
      } catch (error) {
        logger.error('Failed to fetch doc prompt', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'doc') {
      fetchDocPrompt();
    }
  }, [docConfig, activeTab]);

  const copyAsMarkdown = async () => {
    let markdown = '';

    if (activeTab === 'agent' && agentPrompt) {
      markdown = `# Main Agent Prompt Configuration

## Domain
${agentConfig.domain}

## Mode
${agentConfig.mode}

## StreamText Configuration
\`\`\`json
${JSON.stringify(agentPrompt.streamConfig, null, 2)}
\`\`\`

## System Prompt

${agentPrompt.systemPrompt}

## Tool Descriptions

${agentPrompt.toolDescriptions
  .map(
    (tool) =>
      `### ${tool.name} ${tool.isActive ? '(Active)' : '(Inactive)'}\n\n${tool.description}`,
  )
  .join('\n\n---\n\n')}
`;
    } else if (activeTab === 'doc' && docPrompt) {
      markdown = `# Document Generation Prompt

## Document Type
${docConfig.documentType}

## Domain
${docConfig.domain}

## StreamText Configuration
\`\`\`json
${JSON.stringify(docPrompt.streamConfig, null, 2)}
\`\`\`

## System Prompt

${docPrompt.systemPrompt}

## User Prompt

${docPrompt.userPrompt}
`;
    }

    await navigator.clipboard.writeText(markdown);
    alert('Copied to clipboard as Markdown!');
  };

  return (
    <div className="container mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">🔍 Prompt Debugger</h1>
        <Button onClick={copyAsMarkdown} className="gap-2">
          <Copy className="size-4" />
          Copy as Markdown
        </Button>
      </div>

      {/* Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="agent">Main Agent</TabsTrigger>
          <TabsTrigger value="doc">Doc Generation</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="space-y-6">
          <AgentConfigForm config={agentConfig} onChange={setAgentConfig} />

          {agentPrompt && (
            <>
              <StreamConfigDisplay config={agentPrompt.streamConfig} />

              <ToolsDisplay tools={agentPrompt.toolDescriptions} />

              <PromptPreview
                title="System Prompt"
                sections={[
                  {
                    title: 'Base System Prompt',
                    content: agentPrompt.sections.base,
                  },
                  {
                    title: `Generated Capabilities (filtered: ${agentConfig.domain})`,
                    content: agentPrompt.sections.capabilities,
                  },
                  {
                    title: `Domain Prompt: ${agentConfig.domain === 'sales' ? 'Sales Intelligence' : 'Meeting Intelligence'}`,
                    content: agentPrompt.sections.domain,
                  },
                  {
                    title: `Mode Prompt: ${agentConfig.mode === 'discovery' ? 'Discovery Mode' : 'Build Mode'}`,
                    content: agentPrompt.sections.mode,
                  },
                  {
                    title: 'Completion Status',
                    content:
                      agentPrompt.sections.completion ||
                      '(none - task not marked complete)',
                    collapsible: false,
                  },
                ]}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="doc" className="space-y-6">
          <DocConfigForm config={docConfig} onChange={setDocConfig} />

          {docPrompt && (
            <>
              <StreamConfigDisplay config={docPrompt.streamConfig} />

              <PromptPreview
                title="System Prompt"
                sections={[
                  {
                    title: 'Expert System Prompt',
                    content: docPrompt.sections.expertSystem,
                  },
                  {
                    title: 'Required Output Format',
                    content: docPrompt.sections.outputTemplate,
                  },
                ]}
              />

              <PromptPreview
                title="User Prompt"
                sections={[
                  docPrompt.sections.agentContext
                    ? {
                        title: 'Agent Context',
                        content: docPrompt.sections.agentContext,
                        collapsible: false,
                      }
                    : null,
                  {
                    title: 'Primary Document',
                    content: docPrompt.sections.primaryDoc,
                    collapsible: false,
                  },
                  docPrompt.sections.referenceDocs
                    ? {
                        title: 'Reference Documents',
                        content: docPrompt.sections.referenceDocs,
                        collapsible: false,
                      }
                    : null,
                  {
                    title: 'Metadata',
                    content: docPrompt.sections.metadata,
                    collapsible: false,
                  },
                ].filter((s) => s !== null)}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
