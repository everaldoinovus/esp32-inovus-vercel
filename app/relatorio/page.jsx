'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../../lib/supabase'

const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7dias', label: '7 dias' },
  { id: '30dias', label: '30 dias' },
]

function inicioDoPeriodo(periodo) {
  const agora = new Date()
  if (periodo === 'hoje') {
    const inicio = new Date(agora)
    inicio.setHours(0, 0, 0, 0)
    return inicio
  }
  const dias = periodo === '7dias' ? 7 : 30
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)
}

function formatarDuracao(segundos) {
  if (segundos == null) return '—'
  segundos = Math.round(segundos)
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.floor(segundos % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Usa os componentes de data LOCAIS (não toISOString/UTC) para que o bucket
// "hoje"/dia coincida com o fuso horário do navegador do usuário.
function chaveBucket(data, periodo) {
  const ano = data.getFullYear()
  const mes = pad2(data.getMonth() + 1)
  const dia = pad2(data.getDate())
  if (periodo === 'hoje') return `${ano}-${mes}-${dia}T${pad2(data.getHours())}`
  return `${ano}-${mes}-${dia}`
}

function labelBucket(chave, periodo) {
  if (periodo === 'hoje') return `${chave.slice(11, 13)}h`
  const [, mes, dia] = chave.split('-')
  return `${dia}/${mes}`
}

// Distribui um intervalo [inicio, fim) entre os buckets (hora ou dia) que ele atravessa.
function distribuirPorBucket(inicio, fim, estado, periodo, buckets) {
  let cursor = new Date(inicio)
  const fimMs = fim.getTime()
  let guard = 0
  while (cursor.getTime() < fimMs && guard < 10000) {
    guard++
    const proximoLimite = periodo === 'hoje'
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), cursor.getHours() + 1)
      : new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    const fimTrecho = Math.min(proximoLimite.getTime(), fimMs)
    const chave = chaveBucket(cursor, periodo)
    const segundos = Math.max(0, (fimTrecho - cursor.getTime()) / 1000)
    if (!buckets[chave]) buckets[chave] = { ligado: 0, desligado: 0 }
    buckets[chave][estado ? 'ligado' : 'desligado'] += segundos
    cursor = new Date(fimTrecho)
  }
}

function GraficoBarras({ buckets }) {
  if (buckets.length === 0) {
    return <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Sem dados no período selecionado.</p>
  }
  const largura = 720
  const altura = 220
  const margemBaixo = 28
  const margemTopo = 16
  const maxTotal = Math.max(...buckets.map(b => b.ligado + b.desligado), 1)
  const colWidth = (largura - 40) / buckets.length
  const larguraBarra = Math.max(4, Math.min(40, colWidth - 10))
  const escala = (altura - margemBaixo - margemTopo) / maxTotal

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: '100%', height: 'auto', maxWidth: largura, display: 'block' }}>
      <line x1="20" y1={altura - margemBaixo} x2={largura - 10} y2={altura - margemBaixo} stroke="#334155" strokeWidth="1" />
      {buckets.map((b, i) => {
        const x = 20 + i * colWidth + (colWidth - larguraBarra) / 2
        const hLigado = b.ligado * escala
        const hDesligado = b.desligado * escala
        const baseY = altura - margemBaixo
        const yDesligado = baseY - hDesligado
        const yLigado = yDesligado - hLigado
        const total = b.ligado + b.desligado
        const totalH = hLigado + hDesligado
        const pctLigado = total > 0 ? Math.round((b.ligado / total) * 100) : null
        const pctDesligado = pctLigado != null ? 100 - pctLigado : null
        const xLabel = x + larguraBarra / 2
        const yLabelCentro = baseY - totalH / 2 + 3.5
        return (
          <g key={b.chave}>
            {hDesligado > 0 && <rect x={x} y={yDesligado} width={larguraBarra} height={hDesligado} fill="#475569" rx="2" />}
            {hLigado > 0 && <rect x={x} y={yLigado} width={larguraBarra} height={hLigado} fill="#22c55e" rx="2" />}
            {pctLigado != null && <title>{`${pctLigado}% ligada / ${pctDesligado}% desligada`}</title>}
            {pctLigado != null && totalH >= 14 && (
              <text x={xLabel} y={yLabelCentro} textAnchor="middle" fontSize="11" fontWeight="700" fill="#f8fafc">
                {`${pctLigado}%`}
              </text>
            )}
            {pctLigado != null && totalH < 14 && (
              <text x={xLabel} y={Math.min(yLigado, yDesligado) - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">
                {`${pctLigado}%`}
              </text>
            )}
            <text x={xLabel} y={altura - 10} textAnchor="middle" fontSize="10" fill="#64748b">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Linha do tempo de hoje: nivel alto enquanto a maquina fica ligada,
// volta a zero (linha de base) quando desliga. Sempre mostra o dia atual,
// independente do filtro de periodo selecionado acima.
function GraficoLinhaHoje({ eventos, eventoAnterior }) {
  if (!eventoAnterior && eventos.length === 0) {
    return <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Sem dados para hoje ainda.</p>
  }

  const agora = new Date()
  const meiaNoite = new Date(agora)
  meiaNoite.setHours(0, 0, 0, 0)

  const largura = 720
  const altura = 160
  const margemEsq = 60
  const margemDir = 10
  const margemBaixo = 24
  const margemTopo = 16
  const domMs = 24 * 60 * 60 * 1000
  const xScale = (t) => margemEsq + ((t.getTime() - meiaNoite.getTime()) / domMs) * (largura - margemEsq - margemDir)
  const yLigado = margemTopo
  const yDesligado = altura - margemBaixo

  let inicioDesenho = meiaNoite
  let estadoAtual = eventoAnterior ? eventoAnterior.state : null
  if (!eventoAnterior) {
    inicioDesenho = new Date(eventos[0].triggered_at)
    estadoAtual = eventos[0].state
  }

  const pontos = [{ t: inicioDesenho, state: estadoAtual }]
  eventos.forEach((ev, idx) => {
    if (!eventoAnterior && idx === 0) return
    const t = new Date(ev.triggered_at)
    pontos.push({ t, state: estadoAtual })
    estadoAtual = ev.state
    pontos.push({ t, state: estadoAtual })
  })
  pontos.push({ t: agora, state: estadoAtual })

  const path = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${(p.state ? yLigado : yDesligado).toFixed(1)}`)
    .join(' ')

  const marcas = [0, 6, 12, 18, 24]

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={margemEsq} y1={yDesligado} x2={largura - margemDir} y2={yDesligado} stroke="#334155" strokeWidth="1" />
      <text x={margemEsq - 6} y={yLigado + 4} textAnchor="end" fontSize="9" fill="#22c55e">Ligada</text>
      <text x={margemEsq - 6} y={yDesligado + 4} textAnchor="end" fontSize="9" fill="#94a3b8">Desligada</text>
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="2" />
      {marcas.map(h => {
        const x = xScale(new Date(meiaNoite.getTime() + h * 60 * 60 * 1000))
        return <text key={h} x={x} y={altura - 8} textAnchor="middle" fontSize="9" fill="#64748b">{h}h</text>
      })}
    </svg>
  )
}

export default function Relatorio() {
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [eventos, setEventos] = useState([])
  const [eventoAnterior, setEventoAnterior] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('7dias')
  const [erro, setErro] = useState('')
  const [eventosHoje, setEventosHoje] = useState([])
  const [eventoAnteriorHoje, setEventoAnteriorHoje] = useState(null)
  const [loadingHoje, setLoadingHoje] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
        return
      }
      const { data } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()

      // Fase 7.4 (atualizado): relatório agora é acessível a qualquer
      // perfil autenticado, incluindo Visualizador.
      setProfile(data)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!authReady) return
    carregarEventos()
  }, [authReady, periodo])

  // Dados de hoje para o gráfico de linha — independem do filtro de período.
  useEffect(() => {
    if (!authReady) return
    carregarHoje()
  }, [authReady])

  async function carregarHoje() {
    setLoadingHoje(true)
    const supabase = createClient()
    const inicio = inicioDoPeriodo('hoje')

    const [{ data: dados, error: erroEv }, { data: anterior, error: erroAnt }] = await Promise.all([
      supabase
        .from('led_events')
        .select('state, triggered_at')
        .gte('triggered_at', inicio.toISOString())
        .order('triggered_at', { ascending: true }),
      supabase
        .from('led_events')
        .select('state, triggered_at')
        .lt('triggered_at', inicio.toISOString())
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!erroEv && !erroAnt) {
      setEventosHoje(dados || [])
      setEventoAnteriorHoje(anterior || null)
    }
    setLoadingHoje(false)
  }

  async function carregarEventos() {
    setLoading(true)
    setErro('')
    const supabase = createClient()
    const inicio = inicioDoPeriodo(periodo)

    const [{ data: dadosEventos, error: erroEventos }, { data: dadoAnterior, error: erroAnterior }] = await Promise.all([
      supabase
        .from('led_events')
        .select('*, autor:profiles(name, email)')
        .gte('triggered_at', inicio.toISOString())
        .order('triggered_at', { ascending: false }),
      supabase
        .from('led_events')
        .select('state, triggered_at')
        .lt('triggered_at', inicio.toISOString())
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (erroEventos || erroAnterior) {
      setErro((erroEventos || erroAnterior).message)
      setEventos([])
      setEventoAnterior(null)
    } else {
      setEventos(dadosEventos || [])
      setEventoAnterior(dadoAnterior || null)
    }
    setLoading(false)
  }

  const stats = useMemo(() => {
    const periodoInicio = inicioDoPeriodo(periodo)
    const agora = new Date()
    const ascendente = [...eventos].sort((a, b) => new Date(a.triggered_at) - new Date(b.triggered_at))
    const buckets = {}
    let ligadoSeg = 0
    let desligadoSeg = 0

    function registrar(inicio, fim, estado) {
      const segundos = Math.max(0, (fim.getTime() - inicio.getTime()) / 1000)
      if (estado) ligadoSeg += segundos
      else desligadoSeg += segundos
      distribuirPorBucket(inicio, fim, estado, periodo, buckets)
    }

    // Intervalo "aberto" entre o início do período e o primeiro evento real
    // (ou até agora, se nenhum evento ocorreu no período).
    if (eventoAnterior) {
      const fim = ascendente.length > 0 ? new Date(ascendente[0].triggered_at) : agora
      registrar(periodoInicio, fim, eventoAnterior.state)
    }

    ascendente.forEach((ev, idx) => {
      const inicioEv = new Date(ev.triggered_at)
      const fimEv = ev.duration_seconds != null
        ? new Date(inicioEv.getTime() + ev.duration_seconds * 1000)
        : agora
      registrar(inicioEv, fimEv, ev.state)
    })

    const bucketsOrdenados = Object.keys(buckets).sort().map(chave => ({
      chave,
      label: labelBucket(chave, periodo),
      ligado: buckets[chave].ligado,
      desligado: buckets[chave].desligado,
    }))

    return { ligadoSeg, desligadoSeg, acionamentos: eventos.length, buckets: bucketsOrdenados }
  }, [eventos, eventoAnterior, periodo])

  const s = {
    page: { minHeight: '100vh', background: '#0f172a', padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' },
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem' },
    title: { fontSize: '1rem', fontWeight: '600', color: '#94a3b8', marginBottom: '1rem' },
    btn: { padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  }

  if (!authReady) {
    return (
      <main style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontFamily: 'system-ui' }}>Carregando...</p>
      </main>
    )
  }

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>Relatório — Uso da máquina</h1>
        <button onClick={() => window.location.href = '/'} style={{ ...s.btn, background: '#334155', color: '#94a3b8' }}>
          Voltar
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            style={{
              ...s.btn,
              background: periodo === p.id ? '#3b82f6' : 'transparent',
              color: periodo === p.id ? 'white' : '#94a3b8',
              border: periodo === p.id ? 'none' : '1px solid #334155',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {erro && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>Erro ao carregar dados: {erro}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={s.card}>
          <p style={s.title}>Tempo total ligado</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>{formatarDuracao(stats.ligadoSeg)}</p>
        </div>
        <div style={s.card}>
          <p style={s.title}>Tempo total desligado</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#94a3b8' }}>{formatarDuracao(stats.desligadoSeg)}</p>
        </div>
        <div style={s.card}>
          <p style={s.title}>Número de acionamentos</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f1f5f9' }}>{stats.acionamentos}</p>
        </div>
      </div>

      <div style={{ ...s.card, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
          <p style={s.title}>Histórico ao longo do tempo</p>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} /> Ligado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#475569', display: 'inline-block' }} /> Desligado
          </span>
        </div>
        {loading ? <p style={{ color: '#64748b' }}>Carregando...</p> : <GraficoBarras buckets={stats.buckets} />}
      </div>

      <div style={{ ...s.card, marginBottom: '1.5rem' }}>
        <p style={s.title}>Estado da máquina hoje</p>
        {loadingHoje ? <p style={{ color: '#64748b' }}>Carregando...</p> : <GraficoLinhaHoje eventos={eventosHoje} eventoAnterior={eventoAnteriorHoje} />}
      </div>

      <div style={s.card}>
        <p style={s.title}>Histórico de eventos ({eventos.length})</p>
        {loading ? (
          <p style={{ color: '#64748b' }}>Carregando...</p>
        ) : eventos.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Nenhum evento registrado nesse período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px' }}>Data/Hora</th>
                  <th style={{ padding: '8px 6px' }}>Estado</th>
                  <th style={{ padding: '8px 6px' }}>Duração</th>
                  <th style={{ padding: '8px 6px' }}>Acionado por</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev, idx) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '8px 6px', color: '#cbd5e1' }}>{new Date(ev.triggered_at).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                        background: ev.state ? '#22c55e22' : '#47556922',
                        color: ev.state ? '#22c55e' : '#94a3b8',
                      }}>
                        {ev.state ? 'Ligado' : 'Apagado'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', color: '#cbd5e1' }}>
                      {idx === 0 && ev.duration_seconds == null ? 'Em andamento' : formatarDuracao(ev.duration_seconds)}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#64748b' }}>{ev.autor?.name || ev.autor?.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
