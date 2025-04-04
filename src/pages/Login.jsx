import { supabase } from '../supabaseClient'
import { useEffect, useState } from 'react'


export default function Login() {
  const handleLogin = async (provider) => {
    await supabase.auth.signInWithOAuth({ provider })

    const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      console.log('Aktueller Benutzer:', user)
    })
  }, [])
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Login</h2>
      <button
        onClick={() => handleLogin('google')}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-2"
      >
        Login mit Google
      </button>
      {/*<button
        onClick={() => handleLogin('apple')}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Login mit Apple
      </button>*/}


          
    </div>

    
  )
}


