// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cnqqfasrsccbfkcypfmc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucXFmYXNyc2NjYmZrY3lwZm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MDcxMjksImV4cCI6MjA1NzQ4MzEyOX0.yUGck_QiybAtWwrpxYdqQHtGQsk4tevjNUg_UI1bK5A'

            

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Prüfe, ob ein User eingeloggt ist
supabase.auth.getUser().then(({ data, error }) => {
  console.log('Aktueller Benutzer:', data?.user || 'Kein Benutzer eingeloggt');
});
