// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Usamos tus credenciales existentes
const supabaseUrl = 'https://gisyiiljfplywcfhxxem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpc3lpaWxqZnBseXdjZmh4eGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTc2NTgsImV4cCI6MjA5MDczMzY1OH0.aEcymRCas-tjM5Cnts4pfkFmBQALjwOxcUKpp5Qtr5s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);