// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define which routes are accessible without login
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',           // Makes all /sign-in/... routes public
  '/sign-up(.*)',           // Makes all /sign-up/... routes public
  '/api(.*)',               // Keep API routes public if needed
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect the route only if it is NOT public
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
