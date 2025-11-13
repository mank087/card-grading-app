import { createClient } from '@supabase/supabase-js'

// Get the values from .env.local - fallback for browser environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zyxtqcvwkbpvsjsszbzg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'

// Create a single Supabase client with auth options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
