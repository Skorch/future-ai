'use client';

import { useClerk } from '@clerk/nextjs';

export const SignOutForm = () => {
  const { signOut } = useClerk();

  return (
    <form
      className="w-full"
      onSubmit={async (e) => {
        e.preventDefault();
        await signOut(() => {
          window.location.href = '/';
        });
      }}
    >
      <button
        type="submit"
        className="w-full text-left px-1 py-0.5 text-red-500"
      >
        Sign out
      </button>
    </form>
  );
};
