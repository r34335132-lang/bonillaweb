// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Usamos tus credenciales existentes
const supabaseUrl = 'https://gisyiiljfplywcfhxxem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpc3lpaWxqZnBseXdjZmh4eGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTc2NTgsImV4cCI6MjA5MDczMzY1OH0.aEcymRCas-tjM5Cnts4pfkFmBQALjwOxcUKpp5Qtr5s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función para actualizar el método de pago de una reserva existente
export const updateBookingPayment = async (bookingId: string, method: 'tarjeta' | 'transferencia' | 'efectivo' | 'pendiente de pago') => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ payment_method: method })
    .eq('id', bookingId)
    .select();

  if (error) {
    console.error("Error al actualizar el método de pago:", error.message);
    throw error;
  }
  
  return data;
};
