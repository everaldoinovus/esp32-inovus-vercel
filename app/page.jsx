'use client'

import { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt'

export default function Dashboard() {
  const [ledStatus, setLedStatus] = useState(null)
  const [conectado, setConectado] = useState(false)
  const [loading, setLoading] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_BROKER, {
      username: process.env.NEXT_PUBLIC_MQTT_USER,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
      clientId: 'dashboard-' + Math.random().toString(16).slice(2),
    })

    client.on('connect', () => {
      setConectado(true)
      client.subscribe('esp32/led/status')
    })

    client.on('message', (topic, payload) => {
      if (topic === 'esp32/led/status') {
        setLedStatus(payload.toString() === 'true')
        setLoading(false)
      }
    })

    client.on('disconnect', () => setConectado(false))
    client.on('error', () => setConectado(false))

    clientRef.current = client
    return () => client.end()
  }, [])

  const toggleLed = () => {
    if (!clientRef.current || !conectado) return
    setLoading(true)
    const comando = ledStatus ? 'false' : 'true'
    clientRef.current.publish('esp32/led/comando', comando)
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: '#f1f5f9'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#94a3b8' }}>
        INOVUS — Controle ESP32
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3rem', fontSize: '0.875rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: conectado ? '#22c55e' : '#ef4444' }} />
        <span style={{ color: conectado ? '#22c55e' : '#ef4444' }}>
          {conectado ? 'Broker conectado' : 'Desconectado'}
        </span>
      </div>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: ledStatus ? '#facc15' : '#1e293b',
        boxShadow: ledStatus ? '0 0 60px 20px #facc1566' : 'none',
        border: '3px solid #334155',
        marginBottom: '2rem',
        transition: 'all 0.3s ease'
      }} />
      <p style={{ marginBottom: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
        {ledStatus === null ? 'Aguardando status...' : ledStatus ? 'LED LIGADO' : 'LED APAGADO'}
      </p>
      <button
        onClick={toggleLed}
        disabled={!conectado || loading}
        style={{
          padding: '14px 40px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: conectado && !loading ? 'pointer' : 'not-allowed',
          background: ledStatus ? '#ef4444' : '#22c55e',
          color: 'white',
          opacity: conectado && !loading ? 1 : 0.5,
          transition: 'all 0.2s ease'
        }}
      >
        {loading ? 'Aguardando...' : ledStatus ? 'Apagar LED' : 'Ligar LED'}
      </button>
    </main>
  )
}
