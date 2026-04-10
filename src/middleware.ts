import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Custom authentication check: simply check if the custom cookie exists
  const sessionToken = request.cookies.get('custom_session');
  const userLoggedIn = !!sessionToken?.value;

  // If not logged in, redirect to login (except the login page itself)
  if (!userLoggedIn && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If logged in and visiting login, we do NOT redirect to home automatically
  // because the session might be invalid (e.g. DB reset). If the user visits 
  // /login and their session is valid, they will still see the login page.

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
