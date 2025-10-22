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
            card: 'shadow-none border-border',
            headerTitle: 'text-2xl',
            headerSubtitle: 'text-sm text-muted-foreground',
            formButtonPrimary:
              'bg-foreground hover:bg-foreground/90 text-background',
            footerActionLink: 'text-foreground hover:text-foreground/80',
            formFieldInput: 'border-border',
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
