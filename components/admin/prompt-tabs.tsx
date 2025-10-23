'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface PromptTabsProps {
  activeTab: 'main-agent' | 'tool-calls';
  onTabChange: (tab: 'main-agent' | 'tool-calls') => void;
  children: React.ReactNode;
}

export function PromptTabs({
  activeTab,
  onTabChange,
  children,
}: PromptTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        onTabChange(value as 'main-agent' | 'tool-calls')
      }
    >
      <TabsList>
        <TabsTrigger value="main-agent">Main Agent</TabsTrigger>
        <TabsTrigger value="tool-calls">Tool Calls</TabsTrigger>
      </TabsList>
      <TabsContent value={activeTab} className="mt-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}
