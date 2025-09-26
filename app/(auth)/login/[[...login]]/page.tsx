import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="flex h-dvh w-full items-center justify-center px-4">
      <SignIn
        fallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/welcome"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none border-zinc-200 dark:border-zinc-800',
            headerTitle: 'text-2xl',
            headerSubtitle: 'text-sm text-muted-foreground',
            formButtonPrimary:
              'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900',
            footerActionLink:
              'text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300',
            formFieldInput: 'border-zinc-200 dark:border-zinc-800',
            formFieldLabel: 'text-zinc-700 dark:text-zinc-300',
            identityPreviewText: 'text-zinc-700 dark:text-zinc-300',
            identityPreviewEditButton:
              'text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300',
          },
        }}
      />
    </div>
  );
}
