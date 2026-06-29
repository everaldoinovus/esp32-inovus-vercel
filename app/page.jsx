'use client'

import { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [ledStatus, setLedStatus] = useState(null)
  const [conectado, setConectado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const clientRef = useRef(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // Busca perfil do usuário logado
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    })

    // Conexão MQTT
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_BROKER, {
      username: process.env.NEXT_PUBLIC_MQTT_USER,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
      clientId: 'dashboard-' + Math.random().toString(16).slice(2),
    })
    client.on('connect', () => { setConectado(true); client.subscribe('esp32/led/status') })
    client.on('message', (topic, payload) => {
      if (topic === 'esp32/led/status') { setLedStatus(payload.toString() === 'true'); setLoading(false) }
    })
    client.on('disconnect', () => setConectado(false))
    client.on('error', () => setConectado(false))
    clientRef.current = client
    return () => client.end()
  }, [])

  const toggleLed = () => {
    if (!clientRef.current || !conectado) return
    setLoading(true)
    clientRef.current.publish('esp32/led/comando', ledStatus ? 'false' : 'true')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const canControl = profile?.role === 'admin' || profile?.role === 'operator'
  const isAdmin = profile?.role === 'admin'
  const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }

  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' }}>

      {/* Header */}
      <div style={{ position: 'absolute', top: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{profile?.name || profile?.email}</span>
          {profile?.role && (
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: '#1e293b', color: '#64748b', border: '1px solid #334155' }}>
              {ROLE_LABELS[profile.role]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isAdmin && (
            <button onClick={() => router.push('/admin')}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              Usuários
            </button>
          )}
          <button onClick={handleLogout}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>

      {/* Título */}
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#94a3b8' }}>INOVUS — Controle ESP32</h1>

      {/* Status broker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3rem', fontSize: '0.875rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: conectado ? '#22c55e' : '#ef4444' }} />
        <span style={{ color: conectado ? '#22c55e' : '#ef4444' }}>{conectado ? 'Broker conectado' : 'Desconectado'}</span>
      </div>

      {/* LED visual */}
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: ledStatus ? '#facc15' : '#1e293b', boxShadow: ledStatus ? '0 0 60px 20px #facc1566' : 'none', border: '3px solid #334155', marginBottom: '2rem', transition: 'all 0.3s ease' }} />

      <p style={{ marginBottom: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
        {ledStatus === null ? 'Aguardando status...' : ledStatus ? 'LED LIGADO' : 'LED APAGADO'}
      </p>

      {/* Botão — visível apenas para admin e operador */}
      {canControl ? (
        <button onClick={toggleLed} disabled={!conectado || loading}
          style={{ padding: '14px 40px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: conectado && !loading ? 'pointer' : 'not-allowed', background: ledStatus ? '#ef4444' : '#22c55e', color: 'white', opacity: conectado && !loading ? 1 : 0.5, transition: 'all 0.2s ease' }}>
          {loading ? 'Aguardando...' : ledStatus ? 'Apagar LED' : 'Ligar LED'}
        </button>
      ) : (
        <p style={{ color: '#334155', fontSize: '0.8rem', marginTop: '0.5rem' }}>Modo somente leitura</p>
      )}
    </main>
  )
}
