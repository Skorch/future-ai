import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarInsetWithTrigger } from '@/components/sidebar-inset-with-trigger';
import type { ReactNode } from 'react';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  // Get sidebar state from cookies
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar:state')?.value === 'false';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AdminSidebar />
      <SidebarInsetWithTrigger>{children}</SidebarInsetWithTrigger>
    </SidebarProvider>
  );
}
