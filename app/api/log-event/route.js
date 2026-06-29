import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Fase 7 — registra cada mudança de estado do LED e calcula a duração
// do estado anterior, fechando o evento mais recente em aberto.
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const { state, userId } = body

  if (typeof state !== 'boolean') {
    return NextResponse.json({ error: 'state deve ser boolean' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const agora = new Date()

  // Busca o evento mais recente para fechar a duração do estado anterior
  const { data: ultimoEvento, error: erroUltimo } = await supabase
    .from('led_events')
    .select('id, triggered_at')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (erroUltimo) {
    return NextResponse.json({ error: erroUltimo.message }, { status: 400 })
  }

  if (ultimoEvento) {
    const duracaoSegundos = Math.max(
      0,
      Math.round((agora.getTime() - new Date(ultimoEvento.triggered_at).getTime()) / 1000)
    )
    const { error: erroUpdate } = await supabase
      .from('led_events')
      .update({ duration_seconds: duracaoSegundos })
      .eq('id', ultimoEvento.id)

    if (erroUpdate) {
      return NextResponse.json({ error: erroUpdate.message }, { status: 400 })
    }
  }

  const { error: erroInsert } = await supabase
    .from('led_events')
    .insert({
      state,
      triggered_by: userId || null,
      triggered_at: agora.toISOString(),
    })

  if (erroInsert) {
    return NextResponse.json({ error: erroInsert.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
