'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Se já está logado, vai direto pro dashboard
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/'
    })
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '380px' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.25rem', marginBottom: '0.25rem', textAlign: 'center' }}>INOVUS</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', marginBottom: '2rem' }}>Controle ESP32</p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', fontSize: '0.95rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </main>
  )
              }
