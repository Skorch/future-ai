import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes - everything else requires authentication
const isPublicRoute = createRouteMatcher([
  '/', // Landing page is public
  '/login(.*)', // Sign-in pages
  '/register(.*)', // Sign-up pages
  '/waitlist(.*)', // Waitlist pages
  '/api/webhooks/clerk(.*)', // Webhook endpoint must be public
  '/ping', // Playwright test endpoint
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const waitlistPath = process.env.WAITLIST_PATH;

  // Playwright test endpoint
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  const { userId } = await auth();

  // Waitlist mode: redirect unauthenticated users from /register to /waitlist
  if (waitlistPath && !userId && pathname.startsWith('/register')) {
    return NextResponse.redirect(new URL(waitlistPath, req.url));
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    if (!userId) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // If authenticated and trying to access login/register/waitlist, redirect to home
  if (
    userId &&
    ['/login', '/register', '/waitlist'].some((path) =>
      pathname.startsWith(path),
    )
  ) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
