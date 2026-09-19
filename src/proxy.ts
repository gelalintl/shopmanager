import { UserRole } from '@prisma/client'
import { auth } from '@/auth'
import { isManagerRole } from '@/lib/auth'

const MANAGER_PREFIXES = [
  '/dashboard/settings',
  '/dashboard/reports',
  '/dashboard/users',
  '/dashboard/parametres',
]

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname
  const isOnLoginPage = pathname.startsWith('/login')

  if (!isLoggedIn && !isOnLoginPage) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }

  if (isLoggedIn && isOnLoginPage) {
    return Response.redirect(new URL('/dashboard', req.nextUrl))
  }

  const role = req.auth?.user?.role as UserRole | undefined
  if (isLoggedIn && !isManagerRole(role)) {
    const restricted = MANAGER_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
    if (restricted) {
      return Response.redirect(new URL('/dashboard', req.nextUrl))
    }
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
