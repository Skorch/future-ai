import { SignUp } from '@clerk/nextjs';

export default function RegisterPage() {
  return (
    <div className="flex h-dvh w-full items-center justify-center px-4">
      <SignUp
        fallbackRedirectUrl="/welcome"
        forceRedirectUrl="/welcome" // Always go to welcome after signup
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none border-zinc-200 dark:border-zinc-800',
            headerTitle: 'text-2xl',
            headerSubtitle: 'text-sm text-muted-foreground',
            formButtonPrimary:
              'bg-foreground hover:bg-foreground/90 dark:bg-background dark:hover:bg-background/90 dark:text-foreground',
            footerActionLink: 'text-foreground hover:text-foreground/80',
            formFieldInput: 'border-zinc-200 dark:border-zinc-800',
            formFieldLabel: 'text-foreground/80',
            identityPreviewText: 'text-foreground/80',
            identityPreviewEditButton:
              'text-foreground hover:text-foreground/80',
          },
        }}
      />
    </div>
  );
}
