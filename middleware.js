import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Pega o token do cookie de sessão do Supabase
  const token = request.cookies.get('sb-rptwqaewbfophayiomyd-auth-token')?.value

  // Se não há token e não está na rota /login, redireciona
  if (!token && request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Para rota /admin, verifica a role via API
  if (token && request.nextUrl.pathname.startsWith('/admin')) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    } catch (e) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
