import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes - everything else requires authentication
const isPublicRoute = createRouteMatcher([
  '/', // Landing page is public
  '/login(.*)', // Sign-in pages
  '/register(.*)', // Sign-up pages
  '/api/webhooks/clerk(.*)', // Webhook endpoint must be public
  '/ping', // Playwright test endpoint
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Playwright test endpoint
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // If authenticated and trying to access login/register, redirect to home
  const { userId } = await auth();
  if (
    userId &&
    ['/login', '/register'].some((path) => pathname.startsWith(path))
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
