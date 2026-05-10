import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export default function LoginScreen() {
  const { login, register } = useAuth()
  const [mode, setMode]     = useState('login')
  const [form, setForm]     = useState({ email: '', password: '', first_name: '', last_name: '', gender: '' })
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        if (!form.gender) { setError('Please select gender'); setLoading(false); return }
        await register({ email: form.email.trim(), password: form.password, first_name: form.first_name, last_name: form.last_name, gender: form.gender })
      }
    } catch (e) {
      setError(e?.errors?.join(', ') || e?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>SplitRace</Text>
        <Text style={s.subtitle}>GPS Tournament Running</Text>

        <View style={s.card}>
          <View style={s.tabs}>
            {['login', 'register'].map(m => (
              <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabActive]} onPress={() => { setMode(m); setError(null) }}>
                <Text style={[s.tabText, mode === m && s.tabTextActive]}>{m === 'login' ? 'Sign In' : 'Register'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <>
              <TextInput style={s.input} placeholder="First name" value={form.first_name} onChangeText={set('first_name')} />
              <TextInput style={s.input} placeholder="Last name"  value={form.last_name}  onChangeText={set('last_name')} />
              <Text style={s.label}>Gender</Text>
              <View style={s.genderRow}>
                {['male', 'female'].map(g => (
                  <TouchableOpacity key={g} style={[s.genderBtn, form.gender === g && s.genderBtnActive]} onPress={() => set('gender')(g)}>
                    <Text style={[s.genderText, form.gender === g && s.genderTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput style={s.input} placeholder="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={s.input} placeholder="Password" value={form.password} onChangeText={set('password')} secureTextEntry />

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
            <Text style={s.btnText}>{loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: '#1a1a2e' },
  container:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo:            { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  tabs:            { flexDirection: 'row', marginBottom: 20, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f0f0f0' },
  tab:             { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive:       { backgroundColor: '#1a1a2e' },
  tabText:         { fontSize: 14, color: '#555' },
  tabTextActive:   { color: '#fff', fontWeight: '600' },
  label:           { fontSize: 13, color: '#555', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  genderRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderBtn:       { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  genderBtnActive: { borderColor: '#1a1a2e', backgroundColor: '#1a1a2e' },
  genderText:      { color: '#555', fontSize: 14 },
  genderTextActive:{ color: '#fff', fontWeight: '600' },
  error:           { color: '#e53935', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn:             { backgroundColor: '#e53935', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
})
