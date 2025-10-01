'use client';

import { useRouter } from 'next/navigation';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { getDocumentIcon } from '@/lib/utils/document-icons';
import type { DocumentHistory } from './sidebar-documents';

interface DocumentItemProps {
  document: DocumentHistory['documents'][0];
  workspaceId: string;
  isActive: boolean;
  setOpenMobile: (open: boolean) => void;
}

export function DocumentItem({
  document,
  workspaceId,
  isActive,
  setOpenMobile,
}: DocumentItemProps) {
  const router = useRouter();
  const Icon = getDocumentIcon(document.documentType);

  const handleClick = () => {
    setOpenMobile(false);
    router.push(`/workspace/${workspaceId}/document/${document.id}`);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={handleClick}>
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{document.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
