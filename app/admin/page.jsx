'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const ROLE_LABELS = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }
const ROLE_COLORS = { admin: '#3b82f6', operator: '#22c55e', viewer: '#64748b' }

export default function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'viewer' })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  async function updateRole(userId, newRole) {
    setSaving(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    await loadUsers()
    setSaving(null)
  }

  async function createUser() {
    setCreating(true)
    setMsg('')
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const data = await res.json()
    if (data.error) {
      setMsg('Erro: ' + data.error)
    } else {
      setMsg('Usuario criado com sucesso!')
      setNewUser({ email: '', name: '', password: '', role: 'viewer' })
      await loadUsers()
    }
    setCreating(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#0f172a', padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#f1f5f9' },
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' },
    title: { fontSize: '1rem', fontWeight: '600', color: '#94a3b8', marginBottom: '1rem' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #0f172a' },
    input: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.875rem', boxSizing: 'border-box', marginBottom: '0.75rem', outline: 'none' },
    select: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.875rem' },
    btn: { padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer' },
  }

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>Gerenciar Usuarios</h1>
        <button onClick={() => router.push('/')} style={{ ...s.btn, background: '#334155', color: '#94a3b8' }}>
          Voltar
        </button>
      </div>

      <div style={s.card}>
        <p style={s.title}>Adicionar Usuario</p>
        <input placeholder="Nome" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={s.input} />
        <input placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} style={s.input} />
        <input placeholder="Senha inicial" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={s.input} />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={s.select}>
            <option value="viewer">Visualizador</option>
            <option value="operator">Operador</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={createUser} disabled={creating || !newUser.email || !newUser.password}
            style={{ ...s.btn, background: '#3b82f6', color: 'white', opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Criando...' : 'Criar usuario'}
          </button>
        </div>
        {msg && <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: msg.startsWith('Erro') ? '#ef4444' : '#22c55e' }}>{msg}</p>}
      </div>

      <div style={s.card}>
        <p style={s.title}>Usuarios cadastrados ({users.length})</p>
        {loading ? <p style={{ color: '#64748b' }}>Carregando...</p> : users.map(u => (
          <div key={u.id} style={s.row}>
            <div>
              <p style={{ fontWeight: '600', marginBottom: '2px' }}>{u.name || u.email}</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{u.email}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '999px', background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role], fontWeight: '600' }}>
                {ROLE_LABELS[u.role]}
              </span>
              <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                disabled={saving === u.id} style={s.select}>
                <option value="viewer">Visualizador</option>
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
      }
