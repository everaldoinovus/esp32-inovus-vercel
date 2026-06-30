'use client'

import { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt'
import { createClient } from '../lib/supabase'

// null = verificando (cinza), true = conectado (verde), false = desconectado (vermelho c/ risco)
function WifiIcon({ conectado, size = 16 }) {
  const cor = conectado === true ? '#22c55e' : conectado === false ? '#ef4444' : '#64748b'
  if (conectado !== false) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12" y2="20" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12" y2="20" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function Dashboard() {
  const [ledStatus, setLedStatus] = useState(null)
  const [conectado, setConectado] = useState(null) // null=verificando, true=online, false=offline
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const clientRef    = useRef(null)
  const profileRef   = useRef(null)   // acesso ao profile dentro dos closures MQTT
  const pendingRef   = useRef(null)   // { novoEstado, timeoutId, isProbe }
  const ledStatusRef = useRef(null)   // espelho de ledStatus para closures
  const conectadoRef = useRef(null)   // espelho de conectado para closures

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      const { data } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data)
      profileRef.current = data
      setAuthReady(true)
    })

    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_BROKER, {
      username: process.env.NEXT_PUBLIC_MQTT_USER,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
      clientId: 'dashboard-' + Math.random().toString(16).slice(2),
    })

    client.on('connect', () => {
      client.subscribe('esp32/led/status')

      // Probe automático após 1.5 s (tempo para o broker entregar msg retida).
      // Reenvia o estado atual à ESP32 de forma idempotente; se ela responder
      // → online confirmado; se não responder em 4 s → offline confirmado.
      setTimeout(() => {
        if (conectadoRef.current !== null) return // já foi confirmado por outro meio

        if (ledStatusRef.current !== null) {
          // Temos estado retido → probe seguro (operação idempotente)
          const timeoutId = setTimeout(() => {
            if (conectadoRef.current === null) {
              setConectado(false)
              conectadoRef.current = false
            }
            pendingRef.current = null
          }, 4000)
          pendingRef.current = { novoEstado: ledStatusRef.current, timeoutId, isProbe: true }
          client.publish('esp32/led/comando', ledStatusRef.current ? 'true' : 'false')
        } else {
          // Sem msg retida → não há estado para probe seguro; espera mais 3 s
          setTimeout(() => {
            if (conectadoRef.current === null) {
              setConectado(false)
              conectadoRef.current = false
            }
          }, 3000)
        }
      }, 1500)
    })

    client.on('message', (topic, payload) => {
      if (topic !== 'esp32/led/status') return
      const novoLedStatus = payload.toString() === 'true'
      setLedStatus(novoLedStatus)
      ledStatusRef.current = novoLedStatus

      if (pendingRef.current) {
        const { novoEstado, timeoutId, isProbe } = pendingRef.current
        clearTimeout(timeoutId)
        pendingRef.current = null

        // A placa respondeu → confirmada online
        setConectado(true)
        conectadoRef.current = true

        if (!isProbe) {
          // Resposta a um comando real do usuário
          setLoading(false)
          if (novoLedStatus === novoEstado) {
            // Só registra se o estado confirmado bate com o comando enviado
            fetch('/api/log-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: novoLedStatus, userId: profileRef.current?.id }),
            }).catch(() => {})
          }
        }
        // isProbe: apenas confirma conexão, sem log de evento nem alteração de loading
      }
      // Mensagem sem pendingRef = msg retida no carregamento inicial
      // → atualiza ledStatus, mas conectado permanece null até o probe responder
    })

    const marcarOffline = () => { setConectado(false); conectadoRef.current = false }
    client.on('disconnect', marcarOffline)
    client.on('close',      marcarOffline)
    client.on('error',      marcarOffline)
    clientRef.current = client
    return () => client.end()
  }, [])

  const toggleLed = () => {
    if (!clientRef.current || conectado === false) return
    const novoEstado = !ledStatus
    setLoading(true)
    clientRef.current.publish('esp32/led/comando', novoEstado ? 'true' : 'false')

    // Se não houver resposta em 5 s → placa offline
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setConectado(false)
      conectadoRef.current = false
      pendingRef.current = null
    }, 5000)

    pendingRef.current = { novoEstado, timeoutId, isProbe: false }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const canControl = profile?.role === 'admin' || profile?.role === 'operator'
  const isAdmin    = profile?.role === 'admin'
  const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }

  const labelConexao = conectado === true
    ? 'Equipamento conectado'
    : conectado === false
    ? 'Equipamento desconectado'
    : 'Verificando equipamento...'
  const corConexao = conectado === true ? '#22c55e' : conectado === false ? '#ef4444' : '#64748b'

  if (!authReady) {
    return (
      <main style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontFamily: 'system-ui' }}>Carregando...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' }}>

      <div style={{ position: 'absolute', top: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{profile?.name || profile?.email}</span>
          {profile?.role && (
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: '#1e293b', color: '#64748b', border: '1px solid #334155' }}>
              {ROLE_LABELS[profile.role]}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
            <WifiIcon conectado={conectado} />
            <span style={{ color: corConexao, fontSize: '0.8rem' }}>{labelConexao}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => window.location.href = '/relatorio'}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
            Relatório
          </button>
          {isAdmin && (
            <button onClick={() => window.location.href = '/admin'}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              Usuarios
            </button>
          )}
          <button onClick={handleLogout}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '3rem', color: '#94a3b8' }}>ECNC — Monitor Máquina Laser</h1>

      <div style={{ width: 120, height: 120, borderRadius: '50%', background: ledStatus ? '#facc15' : '#1e293b', boxShadow: ledStatus ? '0 0 60px 20px #facc1566' : 'none', border: '3px solid #334155', marginBottom: '2rem', transition: 'all 0.3s ease' }} />

      <p style={{ marginBottom: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
        {ledStatus === null ? 'Aguardando status...' : ledStatus ? 'MÁQUINA LIGADA' : 'MÁQUINA DESLIGADA'}
      </p>

      {canControl ? (
        <button onClick={toggleLed} disabled={conectado === false || loading}
          style={{ padding: '14px 40px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: conectado !== false && !loading ? 'pointer' : 'not-allowed', background: ledStatus ? '#ef4444' : '#22c55e', color: 'white', opacity: conectado !== false && !loading ? 1 : 0.5, transition: 'all 0.2s ease' }}>
          {loading ? 'Aguardando...' : ledStatus ? 'Desligar' : 'Ligar'}
        </button>
      ) : (
        <p style={{ color: '#334155', fontSize: '0.8rem' }}>Modo somente leitura</p>
      )}
    </main>
  )
}
