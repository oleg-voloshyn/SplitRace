import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = params.get('token')
    const error = params.get('error')

    if (error || !token) {
      navigate('/login?error=oauth_failed')
      return
    }

    loginWithToken(token)
      .then(() => navigate('/tournaments'))
      .catch(() => navigate('/login?error=oauth_failed'))
  }, [loginWithToken, navigate, params])

  return <div style={{ padding: '2rem', textAlign: 'center' }}>Signing in...</div>
}
