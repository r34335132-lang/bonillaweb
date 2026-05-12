'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; 
import { FileSpreadsheet, Printer, Bus, Package, CalendarDays, CheckCircle, Clock, XCircle, CreditCard, Banknote, Filter, PlusCircle, Box, Edit3, LogOut, Lock, Ticket, CheckSquare, History, Trash2, Map, Users } from 'lucide-react';

type TabType = 'pagados' | 'intentos' | 'viajes' | 'taquilla' | 'crear-viaje' | 'paqueteria' | 'tarifario' | 'movimientos';

const BONILLA_ROUTE = [
  "Durango", 
  "Nombre de Dios", 
  "Vicente Guerrero", 
  "Sombrerete", 
  "San José de Fénix", 
  "Sain Alto", 
  "Río Florido", 
  "Fresnillo", 
  "Calera",
  "Zacatecas", 
  "Aguascalientes", 
  "San Juan de los Lagos", 
  "Guadalajara"
];

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'supervisor'>('supervisor');
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [defaultPrices, setDefaultPrices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('pagados');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- ESTADOS: VIAJES Y MANIFIESTO ---
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [manifestTrip, setManifestTrip] = useState<any>(null);
  const [manifestPassengers, setManifestPassengers] = useState<any[]>([]);
  const [loadingManifest, setLoadingManifest] = useState(false);

  // --- ESTADOS: CREAR VIAJE (Restaurado con JSONs y 15 días) ---
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [tripForm, setTripForm] = useState({ origin: 'Durango', destination: 'Guadalajara', date: '', departure_time: '', arrival_time: '', total_seats: '40', bus_type: 'Primera Clase', price: '800', price_15_days: '1400' });
  const [cityPrices, setCityPrices] = useState<Record<string, string>>({});
  const [cityRoundPrices, setCityRoundPrices] = useState<Record<string, string>>({});

  // --- ESTADOS: PAQUETERÍA Y TARIFARIO ---
  const [isCreatingParcel, setIsCreatingParcel] = useState(false);
  const [parcelForm, setParcelForm] = useState({ sender: '', receiver: '', origin: 'Durango', destination: 'Guadalajara', price: '' });
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [priceForm, setPriceForm] = useState({ origin: 'Durango', destination: 'Guadalajara', price_one_way: '', price_round_trip: '', price_15_days: '' });

  // --- ESTADOS: TAQUILLA ---
  const [taquillaSaleDate, setTaquillaSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [taquillaForm, setTaquillaForm] = useState({ origin: 'Durango', destination: 'Guadalajara', date: '' });
  const [taquillaTrips, setTaquillaTrips] = useState<any[]>([]);
  const [taquillaSelectedTrip, setTaquillaSelectedTrip] = useState<any>(null);
  const [taquillaOccupiedSeats, setTaquillaOccupiedSeats] = useState<number[]>([]);
  const [taquillaSelectedSeats, setTaquillaSelectedSeats] = useState<number[]>([]);
  const [taquillaPassenger, setTaquillaPassenger] = useState({ name: '', phone: '', status: 'confirmed', priceOverride: '', tripType: 'sencillo' });
  const [isSelling, setIsSelling] = useState(false);

  // --- ESTADOS: REGISTRO HISTÓRICO ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    saleDate: new Date().toISOString().split('T')[0],
    tripDate: new Date().toISOString().split('T')[0],
    origin: 'Durango',
    destination: 'Zacatecas',
    name: '',
    price: '',
    seats: '',
    tripType: 'sencillo'
  });

  // --- ESTADOS: EDICIÓN DE MÉTODO DE PAGO ---
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState({ id: '', folio: '', method: 'efectivo' });
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  useEffect(() => {
    setIsClient(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      const userEmail = session.user.email?.toLowerCase();
      if (userEmail === 'admin@bonillatours.com' || userEmail?.includes('admin') || userEmail === 'contabilidadbonillatours@gmail.com') {
        setUserRole('admin');
      } else {
        setUserRole('supervisor');
      }
      fetchRealData();
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === 'movimientos') fetchLogs();
    if (activeTab === 'viajes') fetchAllTrips();
  }, [activeTab]);

  // Autollenado de la matriz de precios al cambiar origen/destino en Crear Viaje
  useEffect(() => {
    if (defaultPrices.length > 0) autoFillPrices(tripForm.origin, tripForm.destination, defaultPrices);
  }, [defaultPrices, tripForm.origin, tripForm.destination]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) alert("Error al iniciar sesión: Correo o contraseña incorrectos.");
    setIsLoggingIn(false);
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const logAction = async (action: string, description: string) => {
    if (!session) return;
    try {
      await supabase.from('audit_logs').insert({ user_email: session.user.email, action, description });
    } catch (error) { console.error("Error guardando registro de auditoría:", error); }
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1500); 
    if (data) setLogs(data);
  };

  // --- LÓGICA DE VIAJES Y MANIFIESTO ---
  const fetchAllTrips = async () => {
    const { data } = await supabase.from('trips').select('*').order('date', { ascending: false });
    if (data) setAllTrips(data);
  };

  const fetchManifest = async (trip: any) => {
    setManifestTrip(trip);
    setLoadingManifest(true);
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('trip_id', trip.id)
      .neq('status', 'cancelled')
      .order('passenger_name', { ascending: true });
    
    if (data) setManifestPassengers(data);
    setLoadingManifest(false);
  };

  const handleManualBoarding = async (bookingId: string, passengerName: string) => {
    if (!window.confirm(`¿Confirmas que deseas dar acceso (ABORDADO) a ${passengerName}?`)) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'boarded' }).eq('id', bookingId);
      if (error) throw error;
      setManifestPassengers(prev => prev.map(p => p.id === bookingId ? { ...p, status: 'boarded' } : p));
    } catch (error: any) { alert("Error al dar acceso: " + error.message); }
  };

  const fetchRealData = async () => {
    setLoading(true);
    try {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, booking_ref, folio, status, created_at, total_price, passenger_name, is_round_trip, is_15_days, payment_method, origin, destination, seats, trip:trips!bookings_trip_id_fkey(date, departure_time)')
        .order('created_at', { ascending: false })
        .limit(1500);

      if (bookingsData) {
        const formateados = bookingsData.map((b: any) => {
          const fechaBD = new Date(b.created_at);
          const offset = fechaBD.getTimezoneOffset() * 60000;
          const dateOnly = (new Date(fechaBD.getTime() - offset)).toISOString().split('T')[0];
          
          let estadoUI = 'pendiente'; 
          const statusDB = b.status?.toLowerCase();
          if (statusDB === 'paid' || statusDB === 'pagado' || statusDB === 'confirmed' || statusDB === 'boarded') estadoUI = 'pagado';
          else if (statusDB === 'cancelled' || statusDB === 'cancelado') estadoUI = 'cancelado';

          let metodoPagoUI = b.payment_method || 'N/A';
          if (metodoPagoUI.includes('card') || metodoPagoUI === 'tarjeta') metodoPagoUI = 'Tarjeta';
          else if (metodoPagoUI.includes('cash') || metodoPagoUI === 'efectivo') metodoPagoUI = 'Efectivo';
          else if (metodoPagoUI === 'transferencia') metodoPagoUI = 'Transferencia';

          let tipoViaje = 'Viaje Sencillo';
          if (b.is_15_days) tipoViaje = 'Paquete 15 Días';
          else if (b.is_round_trip) tipoViaje = 'Viaje Redondo';

          return {
            id: b.id, folio: b.booking_ref || `FOLIO-${b.folio}`, tipo: tipoViaje, 
            cliente: b.passenger_name || 'Sin nombre', monto: b.total_price || 0, status: estadoUI,
            metodoPago: metodoPagoUI, fechaCompleta: fechaBD.toLocaleString(), dateOnly: dateOnly,
            origen: b.origin || 'N/A', destino: b.destination || 'N/A',
            asientos: b.seats || [],
            fechaViaje: b.trip?.date || 'Fecha por definir',
            horaViaje: b.trip?.departure_time || 'Hora por definir'
          };
        });
        setData(formateados);
      }
      const { data: parcelsData } = await supabase.from('parcels').select('*').order('created_at', { ascending: false }).limit(1500);
      if (parcelsData) setParcels(parcelsData);
      
      const { data: pricesData } = await supabase.from('route_prices').select('*');
      if (pricesData) setDefaultPrices(pricesData);
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  const handleMarkAsPaid = async (bookingId: string, folio: string) => {
    if (userRole !== 'admin') return alert("Solo los administradores pueden confirmar pagos.");
    if (!window.confirm(`¿Confirmar pago en efectivo para el boleto ${folio}?`)) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
      if (error) throw error;
      await logAction('EDITAR_PAGO', `Confirmó pago en efectivo para el folio ${folio}`);
      alert("¡Boleto marcado como pagado!");
      fetchRealData();
    } catch (error: any) { alert("Error al actualizar: " + error.message); }
  };

  const handleDeleteBooking = async (bookingId: string, folio: string) => {
    if (userRole !== 'admin') return alert("Solo los administradores pueden borrar ventas.");
    if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente la venta con folio ${folio}?`)) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      await logAction('BORRAR_VENTA', `Eliminó la venta con folio ${folio} del sistema.`);
      alert(`Venta ${folio} eliminada correctamente.`);
      fetchRealData(); 
    } catch (error: any) { alert("Error al eliminar la venta: " + error.message); }
  };

  const handleUpdatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'admin') return alert("Solo los administradores pueden editar el método de pago.");
    setIsUpdatingPayment(true);
    try {
      const { error } = await supabase.from('bookings').update({ payment_method: editingPayment.method }).eq('id', editingPayment.id);
      if (error) throw error;
      await logAction('EDITAR_METODO_PAGO', `Cambió el método de pago del folio ${editingPayment.folio} a ${editingPayment.method.toUpperCase()}`);
      alert("Método de pago actualizado exitosamente.");
      setShowEditPaymentModal(false);
      fetchRealData();
    } catch (error: any) { alert("Error al actualizar método de pago: " + error.message); } finally { setIsUpdatingPayment(false); }
  };

  const handleSaveHistoricalBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingHistory(true);
    try {
      let currentTripId = null;
      const { data: existingTrips } = await supabase.from('trips').select('id').eq('date', historyForm.tripDate).limit(1);

      if (existingTrips && existingTrips.length > 0) {
        currentTripId = existingTrips[0].id;
      } else {
        const { data: newTrip, error: tripError } = await supabase.from('trips').insert({
          origin: BONILLA_ROUTE[0], destination: BONILLA_ROUTE[BONILLA_ROUTE.length - 1], date: historyForm.tripDate, departure_time: '12:00', arrival_time: '18:00', duration: 'Histórico', price: 0, total_seats: 40, available_seats: 40, occupied_seats: [], bus_type: 'Registro Histórico', amenities: []
        }).select('id').single();
        if (tripError) throw new Error("Error creando viaje histórico: " + tripError.message);
        currentTripId = newTrip.id;
      }

      const seatsArray = historyForm.seats.trim() !== '' ? historyForm.seats.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [0];
      const bookingRef = "OLD-" + Math.floor(100000 + Math.random() * 900000).toString().slice(0, 6);
      
      const { error: bookingError } = await supabase.from('bookings').insert({
        booking_ref: bookingRef, trip_id: currentTripId, passenger_name: historyForm.name, passenger_email: 'historico@bonillatours.com', passenger_phone: '0000000000', payment_method: 'cash', status: 'confirmed', is_guest: true, total_price: Number(historyForm.price) || 0, origin: historyForm.origin, destination: historyForm.destination, seats: seatsArray, is_round_trip: historyForm.tripType === 'redondo', is_15_days: historyForm.tripType === '15_dias', created_at: new Date(`${historyForm.saleDate}T12:00:00Z`).toISOString()
      });

      if (bookingError) throw new Error("Error creando boleto: " + bookingError.message);
      await logAction('REGISTRO_HISTORICO', `Subió boleto pasado ${bookingRef} de ${historyForm.name}`);
      alert("¡Boleto histórico registrado exitosamente!");
      setShowHistoryModal(false);
      setHistoryForm({ ...historyForm, name: '', price: '', seats: '' });
      fetchRealData(); 
    } catch (error: any) { alert(error.message); } finally { setIsSavingHistory(false); }
  };

  const handleSearchTaquilla = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('trips').select('*').eq('date', taquillaForm.date);
    if (data) {
      const oIdx = BONILLA_ROUTE.indexOf(taquillaForm.origin);
      const dIdx = BONILLA_ROUTE.indexOf(taquillaForm.destination);
      if (oIdx === -1 || dIdx === -1 || oIdx === dIdx) return alert("Ruta inválida");

      const isGoingSouth = oIdx < dIdx;
      
      const valid = data.filter((t: any) => {
        const tStart = BONILLA_ROUTE.indexOf(t.origin);
        const tEnd = BONILLA_ROUTE.indexOf(t.destination);
        if (tStart === -1 || tEnd === -1) return false;
        
        const tripGoesSouth = tStart < tEnd;
        if (isGoingSouth !== tripGoesSouth) return false; 

        if (isGoingSouth) return tStart <= oIdx && tEnd >= dIdx;
        else return tStart >= oIdx && tEnd <= dIdx;
      });
      setTaquillaTrips(valid);
      setTaquillaSelectedTrip(null);
    }
  };

  const handleSelectTaquillaTrip = async (trip: any) => {
    const { data: bData } = await supabase.from('bookings').select('seats, origin, destination').eq('trip_id', trip.id).neq('status', 'cancelled');
    
    let occupied: number[] = [];
    if (bData) {
      const oIdx = BONILLA_ROUTE.indexOf(taquillaForm.origin);
      const dIdx = BONILLA_ROUTE.indexOf(taquillaForm.destination);
      const isGoingSouth = oIdx < dIdx;
      
      bData.forEach((b: any) => {
        const bStart = BONILLA_ROUTE.indexOf(b.origin);
        const bEnd = BONILLA_ROUTE.indexOf(b.destination);
        if (bStart === -1 || bEnd === -1) return;

        const bookingGoingSouth = bStart < bEnd;
        if (isGoingSouth === bookingGoingSouth) {
          if (isGoingSouth) {
            if (bStart < dIdx && bEnd > oIdx) occupied.push(...b.seats);
          } else {
            if (bStart > dIdx && bEnd < oIdx) occupied.push(...b.seats);
          }
        }
      });
    }
    setTaquillaOccupiedSeats(Array.from(new Set(occupied)));
    setTaquillaSelectedSeats([]);

    // Extraer el precio global del Tarifario (route_prices)
    const { data: priceData } = await supabase
      .from('route_prices')
      .select('*')
      .or(`and(origin.eq.${taquillaForm.origin},destination.eq.${taquillaForm.destination}),and(origin.eq.${taquillaForm.destination},destination.eq.${taquillaForm.origin})`)
      .single();

    let finalPrice = 0;
    if (priceData) {
      if (taquillaPassenger.tripType === 'redondo') finalPrice = priceData.price_round_trip;
      else if (taquillaPassenger.tripType === '15_dias') finalPrice = priceData.price_15_days;
      else finalPrice = priceData.price_one_way;
    } else {
      // Fallback si no está en Tarifario
      finalPrice = trip.price;
    }
    
    setTaquillaPassenger(prev => ({ ...prev, name: '', phone: '', status: 'confirmed', priceOverride: finalPrice.toString() }));
    setTaquillaSelectedTrip(trip);
  };

  const handleTaquillaTripTypeChange = async (type: string) => {
    setTaquillaPassenger(prev => ({ ...prev, tripType: type }));
    
    if (taquillaSelectedTrip) {
      const { data: priceData } = await supabase
        .from('route_prices')
        .select('*')
        .or(`and(origin.eq.${taquillaForm.origin},destination.eq.${taquillaForm.destination}),and(origin.eq.${taquillaForm.destination},destination.eq.${taquillaForm.origin})`)
        .single();

      let newP = 0;
      if (priceData) {
        if (type === 'redondo') newP = priceData.price_round_trip;
        else if (type === '15_dias') newP = priceData.price_15_days;
        else newP = priceData.price_one_way;
      } else {
        newP = taquillaSelectedTrip.price;
      }
      setTaquillaPassenger(prev => ({ ...prev, priceOverride: newP.toString() }));
    }
  };

  const handleSellTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taquillaSelectedSeats.length === 0) return alert("Selecciona al menos un asiento.");
    if (!taquillaPassenger.name.trim()) return alert("Ingresa el nombre del pasajero.");
    
    setIsSelling(true);
    try {
      const bookingRef = "BT-" + Math.floor(100000 + Math.random() * 900000).toString().slice(0, 6);
      const unitPrice = Number(taquillaPassenger.priceOverride) || 0;
      
      const { error } = await supabase.from('bookings').insert({
        booking_ref: bookingRef, trip_id: taquillaSelectedTrip.id, passenger_name: taquillaPassenger.name, passenger_email: 'taquilla@bonillatours.com', passenger_phone: taquillaPassenger.phone || '0000000000', payment_method: 'cash', status: taquillaPassenger.status, is_guest: true, total_price: unitPrice * taquillaSelectedSeats.length, origin: taquillaForm.origin, destination: taquillaForm.destination, seats: taquillaSelectedSeats, is_round_trip: taquillaPassenger.tripType === 'redondo', is_15_days: taquillaPassenger.tripType === '15_dias', created_at: new Date(`${taquillaSaleDate}T12:00:00Z`).toISOString()
      });

      if (error) throw error;
      await logAction('CREAR_BOLETO', `Emitió boleto ${bookingRef} en taquilla para ${taquillaPassenger.name}`);
      
      alert(`¡Venta Exitosa! Folio: ${bookingRef}`);
      setTaquillaSelectedTrip(null);
      fetchRealData();
    } catch (err: any) { alert("Error: " + err.message); } finally { setIsSelling(false); }
  };

  const toggleTaquillaSeat = (seat: number) => {
    if (taquillaOccupiedSeats.includes(seat)) return;
    if (taquillaSelectedSeats.includes(seat)) setTaquillaSelectedSeats(taquillaSelectedSeats.filter(s => s !== seat));
    else setTaquillaSelectedSeats([...taquillaSelectedSeats, seat]);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (priceForm.origin === priceForm.destination) return alert("Origen y destino iguales.");
    setIsSavingPrice(true);
    try {
      const existe = defaultPrices.find(p => (p.origin === priceForm.origin && p.destination === priceForm.destination) || (p.origin === priceForm.destination && p.destination === priceForm.origin));
      
      if (existe) {
        await supabase.from('route_prices').update({ price_one_way: Number(priceForm.price_one_way), price_round_trip: Number(priceForm.price_round_trip), price_15_days: Number(priceForm.price_15_days) }).eq('id', existe.id);
        await logAction('EDITAR_PRECIO', `Actualizó tarifa ${priceForm.origin} - ${priceForm.destination}`);
        alert("Tarifa actualizada.");
      } else {
        await supabase.from('route_prices').insert({ origin: priceForm.origin, destination: priceForm.destination, price_one_way: Number(priceForm.price_one_way), price_round_trip: Number(priceForm.price_round_trip), price_15_days: Number(priceForm.price_15_days) });
        await logAction('NUEVO_PRECIO', `Creó tarifa ${priceForm.origin} - ${priceForm.destination}`);
        alert("Tarifa guardada.");
      }
      
      setPriceForm({ origin: 'Durango', destination: 'Guadalajara', price_one_way: '', price_round_trip: '', price_15_days: '' });
      const { data: pricesData } = await supabase.from('route_prices').select('*');
      if (pricesData) setDefaultPrices(pricesData);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSavingPrice(false); }
  };

  // Autollenado para la matriz
  const autoFillPrices = (originName: string, destName: string, tarifario: any[]) => {
    const oIdx = BONILLA_ROUTE.indexOf(originName);
    const dIdx = BONILLA_ROUTE.indexOf(destName);
    let stops: string[] = [];
    if (oIdx !== -1 && dIdx !== -1 && oIdx !== dIdx) {
      if (oIdx < dIdx) stops = BONILLA_ROUTE.slice(oIdx + 1, dIdx + 1);
      else stops = BONILLA_ROUTE.slice(dIdx, oIdx).reverse();
    }
    const newCityPrices: Record<string, string> = {};
    const newRoundPrices: Record<string, string> = {};
    stops.forEach(dest => {
      const def = tarifario.find(p => (p.origin === originName && p.destination === dest) || (p.origin === dest && p.destination === originName));
      newCityPrices[dest] = def ? def.price_one_way.toString() : '';
      newRoundPrices[dest] = def ? def.price_round_trip.toString() : '';
    });
    setCityPrices(newCityPrices); setCityRoundPrices(newRoundPrices);
  };

  // --- RESTAURADO: CREAR VIAJE CON MATRIZ DE PRECIOS Y 15 DIAS ---
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTrip(true);
    try {
      const { error } = await supabase.from("trips").insert({
        origin: tripForm.origin, 
        destination: tripForm.destination, 
        date: tripForm.date, 
        departure_time: tripForm.departure_time, 
        arrival_time: tripForm.arrival_time, 
        duration: "Aprox 10h", 
        price: Number(tripForm.price), 
        prices: cityPrices, 
        round_trip_prices: cityRoundPrices, 
        price_15_days: Number(tripForm.price_15_days) || 0,
        total_seats: Number(tripForm.total_seats), 
        available_seats: Number(tripForm.total_seats), 
        occupied_seats: [], 
        bus_type: tripForm.bus_type, 
        amenities: ["WiFi", "A/C", "WC"],
      });
      if (error) throw error;
      await logAction('CREAR_VIAJE', `Programó viaje de ${tripForm.origin} a ${tripForm.destination} para el ${tripForm.date}`);
      alert("¡Viaje publicado!");
      setTripForm({ ...tripForm, date: "", departure_time: "", arrival_time: "" }); 
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsCreatingTrip(false); }
  };

  const handleCreateParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingParcel(true);
    try {
      const { error } = await supabase.from('parcels').insert({ sender_name: parcelForm.sender, receiver_name: parcelForm.receiver, origin: parcelForm.origin, destination: parcelForm.destination, price: Number(parcelForm.price), status: 'pending' });
      if (error) throw error;
      await logAction('CREAR_PAQUETE', `Registró paquete de ${parcelForm.sender} a ${parcelForm.receiver}`);
      alert("Paquete registrado.");
      setParcelForm({ ...parcelForm, sender: '', receiver: '', price: '' });
      fetchRealData(); 
    } catch (err: any) { alert("Error: " + err.message); } finally { setIsCreatingParcel(false); }
  };

  if (!isClient) return null;

  if (authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-medium text-gray-500">Cargando plataforma...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
          <div className="flex justify-center mb-6"><div className="bg-blue-600 p-4 rounded-full"><Lock className="text-white" size={32} /></div></div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Acceso Administrativo</h1>
          <p className="text-center text-gray-500 mb-8">Ingresa tus credenciales para acceder al Panel de Bonilla Tours.</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label><input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full border rounded-lg p-3 bg-gray-50 focus:outline-blue-600" placeholder="admin@bonillatours.com" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label><input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full border rounded-lg p-3 bg-gray-50 focus:outline-blue-600" placeholder="••••••••" /></div>
            <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-colors mt-4">{isLoggingIn ? 'Verificando...' : 'Entrar al Panel'}</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredByDate = data.filter((item: any) => {
    if (!startDate || !endDate) return true; 
    return item.dateOnly >= startDate && item.dateOnly <= endDate;
  });

  const finalFilteredData = filteredByDate.filter((item: any) => {
    if (activeTab === 'pagados') return item.status === 'pagado';
    if (activeTab === 'intentos') return item.status === 'pendiente' || item.status === 'cancelado';
    return true;
  });

  const ingresosDelFiltro = filteredByDate.filter((item: any) => item.status === 'pagado').reduce((acc: any, curr: any) => acc + curr.monto, 0);

  const agruparPorMes = (datos: any[]) => {
    return datos.reduce((acc: any, item: any) => {
      const [year, month] = item.dateOnly.split('-');
      const fecha = new Date(Number(year), Number(month) - 1);
      const nombreMes = fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
      if (!acc[nombreMes]) acc[nombreMes] = [];
      acc[nombreMes].push(item);
      return acc;
    }, {} as Record<string, any[]>);
  };

  const datosAgrupados = agruparPorMes(finalFilteredData);

  const handleExportCSV = () => {
    const headers = "Folio,Estado,Concepto,Origen,Destino,Pasajero,Método de Pago,Fecha/Hora,Monto\n";
    const rows = finalFilteredData.map((item: any) => `${item.folio},${item.status},${item.tipo},"${item.origen}","${item.destino}","${item.cliente}",${item.metodoPago},"${item.fechaCompleta}",${item.monto}`).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Reporte_BonillaTours.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printTicket = (item: any) => {
    if (item.status !== 'pagado') { alert("Solo se pueden generar tickets de compras pagadas."); return; }
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>Ticket ${item.folio}</title><style>@page { size: 58mm auto; margin: 0mm; } body { width: 58mm !important; max-width: 58mm !important; margin: 0 !important; padding: 0 !important; background-color: #fff; color: #000; font-family: 'Courier New', Courier, monospace; } .ticket { width: 58mm; padding: 2mm 3mm; box-sizing: border-box; font-size: 11px; line-height: 1.2; } .header { text-align: center; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px; } .header h2 { margin: 0; font-size: 14px; font-weight: bold; } .header p { margin: 2px 0 0 0; font-size: 9px; } .item { margin-bottom: 4px; } .label { font-weight: bold; font-size: 10px; display: block; } .value { display: block; font-size: 11px; margin-left: 4px; word-break: break-word; } .total { font-size: 13px; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; text-align: right; } .footer { text-align: center; margin-top: 15px; font-size: 9px; padding-bottom: 15px; }</style></head><body><div class="ticket"><div class="header"><h2>BONILLA TOURS</h2><p>Comprobante de Pago</p></div><div class="item"><span class="label">Folio:</span> <span class="value">${item.folio}</span></div><div class="item"><span class="label">Fecha:</span> <span class="value">${item.fechaCompleta}</span></div><div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div><div class="item"><span class="label">Pasajero:</span> <span class="value">${item.cliente}</span></div><div class="item"><span class="label">Ruta:</span> <span class="value">${item.origen} a ${item.destino}</span></div><div class="item"><span class="label">Concepto:</span> <span class="value">${item.tipo}</span></div><div class="item"><span class="label">Método:</span> <span class="value">${item.metodoPago}</span></div><div class="total">TOTAL: $${Number(item.monto).toFixed(2)}</div><div class="footer"><p style="margin-bottom: 2px;">¡Gracias por su preferencia!</p><p style="margin-top:0;">Conserve este ticket</p></div></div><script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const printBoleto = (item: any) => {
    if (item.status !== 'pagado') { alert("Solo se pueden generar boletos de compras pagadas."); return; }
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    const html = `<!DOCTYPE html><html><head><title>Boleto ${item.folio}</title><style>@page { size: 58mm auto; margin: 0mm; } body { width: 58mm !important; max-width: 58mm !important; margin: 0 !important; padding: 0 !important; background-color: #fff; color: #000; font-family: 'Courier New', Courier, monospace; } .boleto { width: 58mm; padding: 2mm 2mm; box-sizing: border-box; } .text-center { text-align: center; } .text-bold { font-weight: bold; } .logo { max-width: 40mm; margin: 0 auto 5px; display: block; } .divider { border-bottom: 1px dashed #000; margin: 6px 0; } .item { margin-bottom: 4px; } .label { font-size: 9px; font-weight: bold; display: block; } .value { font-size: 11px; display: block; margin-left: 2px; word-break: break-word; } .dest-box { border: 1px solid #000; padding: 4px; text-align: center; margin: 6px 0; } .dest-label { font-size: 9px; font-weight: bold; margin-bottom: 2px; } .dest-value { font-size: 13px; font-weight: bold; text-transform: uppercase; } .qr-container { text-align: center; margin: 8px 0; } .qr-code { width: 35mm; height: 35mm; margin: 0 auto; display: block; } .terms { font-size: 8px; text-align: left; margin-top: 8px; line-height: 1.1; } .terms h4 { font-size: 9px; text-align: center; margin: 0 0 4px 0; border-bottom: 1px solid #000; padding-bottom: 2px; } .terms p { margin: 2px 0; }</style></head><body><div class="boleto"><img src="https://gisyiiljfplywcfhxxem.supabase.co/storage/v1/object/public/fls/WhatsApp%20Image%202026-05-04%20at%205.53.38%20PM.jpeg" class="logo" alt="Bonilla Tours" /><div class="text-center text-bold" style="font-size: 12px;">BOLETO DE VIAJE</div><div class="divider"></div><div class="item"><span class="label">Pasajero:</span> <span class="value">${item.cliente}</span></div><div class="dest-box"><div class="dest-label">RUTA</div><div class="dest-value">${item.origen} ➔ ${item.destino}</div></div><div class="item"><span class="label">Fecha y Hora:</span> <span class="value">${item.fechaViaje} - ${item.horaViaje}</span></div><div class="item"><span class="label">Tipo:</span> <span class="value">${item.tipo}</span></div><div class="item"><span class="label">Asiento(s):</span> <span class="value">${item.asientos.length > 0 ? item.asientos.join(', ') : 'Asignado al abordar'}</span></div><div class="item"><span class="label">Total Pagado:</span> <span class="value text-bold">$${Number(item.monto).toFixed(2)} MXN</span></div><div class="divider"></div><div class="qr-container"><img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${item.folio}" alt="QR" /><div class="label" style="margin-top:4px;">Folio de Reserva</div><div class="text-bold" style="font-size: 13px;">${item.folio}</div><div style="font-size: 8px; margin-top: 4px;">Emitido: ${item.fechaCompleta}</div></div><div class="divider"></div><div class="terms"><h4>TÉRMINOS Y CONDICIONES</h4><p>- Preséntese 20 min antes de su viaje.</p><p>- Muestre el QR o este ticket impreso para abordar.</p><p>- Tolerancia máx de 5 min en espera.</p><p>- Puntos de ascenso/descenso sujetos a cambios.</p><p>- Cancelaciones: 10% de cargo, mín. 1 hr en oficina.</p></div></div><script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel Central</h1>
            <p className="text-gray-500">Bonilla Tours - Administración Operativa</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
              {userRole === 'admin' ? 'Admin: ' : 'Supervisor: '} {session?.user?.email}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg font-bold transition-colors">
              <LogOut size={18} /> Salir
            </button>
          </div>
        </header>

        <div className="flex space-x-2 mb-6 bg-white p-2 rounded-xl border shadow-sm w-fit overflow-x-auto">
          <button onClick={() => setActiveTab('pagados')} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'pagados' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Boletos Vendidos</button>
          <button onClick={() => setActiveTab('intentos')} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'intentos' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Intentos / Pendientes</button>
          <button onClick={() => setActiveTab('viajes')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'viajes' ? 'bg-cyan-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Map size={18} /> Viajes / Manifiesto</button>
          <button onClick={() => setActiveTab('taquilla')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'taquilla' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Ticket size={18} /> Taquilla (Vender)</button>
          <button onClick={() => setActiveTab('paqueteria')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'paqueteria' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Package size={18} /> Paquetería</button>
          <button onClick={() => setActiveTab('crear-viaje')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'crear-viaje' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><PlusCircle size={18} /> Programar Viaje</button>
          <button onClick={() => setActiveTab('tarifario')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'tarifario' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Edit3 size={18} /> Tarifario</button>
          <button onClick={() => setActiveTab('movimientos')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'movimientos' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><History size={18} /> Movimientos</button>
        </div>

        {/* --- VISTA: VIAJES Y MANIFIESTO --- */}
        {activeTab === 'viajes' && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Map className="text-cyan-600" /> Viajes Programados (Toca para ver Lista de Pasajeros)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTrips.map(trip => (
                <div key={trip.id} onClick={() => fetchManifest(trip)} className="border rounded-xl p-5 cursor-pointer hover:border-cyan-500 hover:shadow-md transition-all bg-gray-50">
                  <div className="font-bold text-gray-800 text-lg">{trip.origin} ➔ {trip.destination}</div>
                  <div className="text-sm text-gray-500 mb-3 mt-1 flex items-center gap-2">
                    <CalendarDays size={14} /> {trip.date} • <Clock size={14} /> {trip.departure_time}
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t">
                     <span className="text-xs bg-gray-200 px-2 py-1 rounded font-semibold text-gray-700">{trip.bus_type}</span>
                     <span className="text-xs font-bold text-cyan-600 flex items-center gap-1"><Users size={14}/> Ver Pasajeros</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VISTA: TAQUILLA --- */}
        {activeTab === 'taquilla' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Ticket className="text-emerald-600" /> Buscar Viaje</h2>
              <form onSubmit={handleSearchTaquilla} className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Origen (Subida)</label>
                    <select value={taquillaForm.origin} onChange={e => setTaquillaForm({...taquillaForm, origin: e.target.value})} className="w-full border rounded-lg p-2 text-sm bg-white">
                      {BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Destino (Bajada)</label>
                    <select value={taquillaForm.destination} onChange={e => setTaquillaForm({...taquillaForm, destination: e.target.value})} className="w-full border rounded-lg p-2 text-sm bg-white">
                      {BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Fecha del Viaje</label>
                  <input type="date" required value={taquillaForm.date} onChange={e => setTaquillaForm({...taquillaForm, date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm transition-colors">Buscar Autobuses</button>
              </form>

              {taquillaTrips.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-700 border-b pb-2">Resultados ({taquillaTrips.length})</h3>
                  {taquillaTrips.map((trip: any) => (
                    <div key={trip.id} className={`p-4 border rounded-xl cursor-pointer transition-colors ${taquillaSelectedTrip?.id === trip.id ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'}`} onClick={() => handleSelectTaquillaTrip(trip)}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800 block text-lg">{trip.departure_time}</span>
                          <span className="text-xs text-gray-500">Ruta Base: {trip.origin} a {trip.destination}</span>
                        </div>
                        <span className="text-sm bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-semibold">{trip.bus_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {taquillaSelectedTrip && (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Completar Venta</h2>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Selecciona Asientos (Clic para elegir)</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: taquillaSelectedTrip.total_seats }).map((_, i) => {
                      const seatNum = i + 1;
                      const isOccupied = taquillaOccupiedSeats.includes(seatNum);
                      const isSelected = taquillaSelectedSeats.includes(seatNum);
                      return (
                        <button
                          key={seatNum} type="button" disabled={isOccupied} onClick={() => toggleTaquillaSeat(seatNum)}
                          className={`w-10 h-10 rounded-md font-bold text-sm flex items-center justify-center transition-colors 
                            ${isOccupied ? 'bg-red-100 text-red-400 cursor-not-allowed' : 
                              isSelected ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          {seatNum}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Seleccionados: {taquillaSelectedSeats.length === 0 ? 'Ninguno' : taquillaSelectedSeats.join(', ')}</p>
                </div>

                <form onSubmit={handleSellTicket} className="space-y-4">
                  <div className="mb-4 bg-gray-50 p-3 rounded-lg border">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Boleto</label>
                    <select
                      value={taquillaPassenger.tripType}
                      onChange={(e) => handleTaquillaTripTypeChange(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm font-semibold text-emerald-800 bg-white"
                    >
                      <option value="sencillo">Viaje Sencillo</option>
                      <option value="redondo">Viaje Redondo (Ida y Vuelta)</option>
                      <option value="15_dias">Paquete 15 Días (Regreso Abierto)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Pasajero</label>
                      <input type="text" required value={taquillaPassenger.name} onChange={e => setTaquillaPassenger({...taquillaPassenger, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Ej. Juan Pérez" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono (Opcional)</label>
                      <input type="text" value={taquillaPassenger.phone} onChange={e => setTaquillaPassenger({...taquillaPassenger, phone: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="10 dígitos" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Precio Unitario ($)</label>
                      <input type="number" required value={taquillaPassenger.priceOverride} onChange={e => setTaquillaPassenger({...taquillaPassenger, priceOverride: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold text-emerald-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Estado del Boleto</label>
                      <select value={taquillaPassenger.status} onChange={e => setTaquillaPassenger({...taquillaPassenger, status: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-semibold">
                        <option value="confirmed">Pagado en Taquilla (Confirmado)</option>
                        <option value="pending">Solo Apartar (Pendiente)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                    <label className="block text-xs font-bold text-orange-900 mb-1">Fecha de Registro de Venta</label>
                    <input 
                      type="date" 
                      required 
                      value={taquillaSaleDate} 
                      onChange={e => setTaquillaSaleDate(e.target.value)} 
                      className="w-full border rounded-lg p-2 text-sm text-orange-900 bg-white border-orange-300" 
                    />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-4 flex justify-between items-center">
                    <span className="font-bold text-emerald-800">Total a Cobrar:</span>
                    <span className="text-2xl font-black text-emerald-600">${(Number(taquillaPassenger.priceOverride) || 0) * taquillaSelectedSeats.length}</span>
                  </div>

                  <button type="submit" disabled={isSelling || taquillaSelectedSeats.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm mt-2 transition-colors disabled:opacity-50">
                    {isSelling ? 'Procesando...' : 'Emitir Boleto'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* --- VISTA: PROGRAMAR VIAJE --- */}
        {activeTab === 'crear-viaje' && (
          <div className="bg-white rounded-xl border shadow-sm p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Bus className="text-blue-600" /> Crear Salida y Matriz de Precios</h2>
            <form onSubmit={handleCreateTrip} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Origen General</label><select value={tripForm.origin} onChange={e => setTripForm({...tripForm, origin: e.target.value})} className="w-full border rounded-lg p-2 bg-white">{BONILLA_ROUTE.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Destino Final</label><select value={tripForm.destination} onChange={(e) => setTripForm({...tripForm, destination: e.target.value})} className="w-full border rounded-lg p-2 bg-white">{BONILLA_ROUTE.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Fecha Salida</label><input type="date" required value={tripForm.date} onChange={(e) => setTripForm({...tripForm, date: e.target.value})} className="w-full border rounded-lg p-2" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Hora Salida</label><input type="time" required value={tripForm.departure_time} onChange={(e) => setTripForm({...tripForm, departure_time: e.target.value})} className="w-full border rounded-lg p-2" /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                  <label className="block text-xs font-bold text-blue-800 mb-1">Precio Base (Ida) $</label>
                  <input type="number" required value={tripForm.price} onChange={(e) => setTripForm({...tripForm, price: e.target.value})} className="w-full border border-blue-300 rounded-lg p-2 text-sm font-bold bg-white" />
                </div>
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl flex items-center gap-4">
                  <div className="bg-purple-100 p-3 rounded-full"><CalendarDays className="text-purple-600" size={24} /></div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-purple-800 mb-1">Precio 15 Días $</label>
                    <input type="number" value={tripForm.price_15_days} onChange={(e) => setTripForm({...tripForm, price_15_days: e.target.value})} className="w-full border border-purple-300 rounded-lg p-2 text-sm font-bold text-purple-900 bg-white" placeholder="Ej. 1400" />
                  </div>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="bg-blue-900 px-4 py-3 text-white font-bold flex justify-between items-center">
                  <span>Precios Dinámicos: {tripForm.origin} ➔ {tripForm.destination}</span>
                  <span className="text-xs font-normal bg-blue-800 px-3 py-1 rounded border border-blue-700">Se llenan solos desde Tarifario</span>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  {BONILLA_ROUTE.slice(BONILLA_ROUTE.indexOf(tripForm.origin) + 1).map((dest: string) => {
                    // Evitar mostrar la parada si está después del destino final
                    if (BONILLA_ROUTE.indexOf(dest) > BONILLA_ROUTE.indexOf(tripForm.destination)) return null;

                    return (
                      <div key={dest} className="flex items-center justify-between border-b pb-3">
                        <span className="font-bold text-gray-700 w-1/3">Baja en: {dest}</span>
                        <div className="flex gap-4 w-2/3">
                          <div className="flex-1"><label className="text-xs text-gray-500">Sencillo ($)</label><input type="number" placeholder="0" value={cityPrices[dest] || ''} onChange={(e) => setCityPrices({...cityPrices, [dest]: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                          <div className="flex-1"><label className="text-xs text-gray-500">Redondo ($)</label><input type="number" placeholder="0" value={cityRoundPrices[dest] || ''} onChange={(e) => setCityRoundPrices({...cityRoundPrices, [dest]: e.target.value})} className="w-full border rounded-lg p-2 text-sm border-blue-200 bg-blue-50" /></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Nº Asientos</label><input type="number" required value={tripForm.total_seats} onChange={(e) => setTripForm({...tripForm, total_seats: e.target.value})} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Hora Llegada (Dest. Final)</label><input type="time" required value={tripForm.arrival_time} onChange={(e) => setTripForm({...tripForm, arrival_time: e.target.value})} className="w-full border rounded-lg p-3" /></div>
              </div>
              <button type="submit" disabled={isCreatingTrip} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors flex justify-center items-center gap-2">{isCreatingTrip ? 'Guardando Viaje...' : <><CheckCircle size={20}/> Publicar Viaje y Precios</>}</button>
            </form>
          </div>
        )}

        {/* --- VISTA: HISTORIAL DE MOVIMIENTOS --- */}
        {activeTab === 'movimientos' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden max-w-6xl mx-auto">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 flex items-center gap-2"><History className="text-indigo-600"/> Historial de Movimientos</h2>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-gray-500 font-medium border-b sticky top-0">
                  <tr>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Usuario Responsable</th>
                    <th className="px-6 py-4">Tipo de Acción</th>
                    <th className="px-6 py-4">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-800">
                  {logs.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No hay movimientos registrados.</td></tr>
                  ) : (
                    logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 font-bold">{log.user_email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.action.includes('BORRAR') ? 'bg-red-100 text-red-700' : log.action.includes('EDITAR') ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">{log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VISTA: TARIFARIO --- */}
        {activeTab === 'tarifario' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6 col-span-1 h-fit relative">
              {userRole !== 'admin' && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border p-4 text-center">
                  <Lock className="text-gray-400 mb-2" size={32}/>
                  <p className="font-bold text-gray-800">Acceso Restringido</p>
                  <p className="text-xs text-gray-500">Solo administradores pueden cambiar tarifas globales.</p>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Edit3 className="text-purple-600" /> Configurar Ruta</h2>
              <form onSubmit={handleSavePrice} className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Sube en (Origen)</label><select value={priceForm.origin} onChange={e => setPriceForm({...priceForm, origin: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Baja en (Destino)</label><select value={priceForm.destination} onChange={e => setPriceForm({...priceForm, destination: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Precio Normal (Ida) $</label>
                  <input type="number" required value={priceForm.price_one_way} onChange={e => setPriceForm({...priceForm, price_one_way: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Precio Ida y Vuelta $</label>
                  <input type="number" required value={priceForm.price_round_trip} onChange={e => setPriceForm({...priceForm, price_round_trip: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Precio 15 Días $</label>
                  <input type="number" required value={priceForm.price_15_days} onChange={e => setPriceForm({...priceForm, price_15_days: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>

                <button type="submit" disabled={isSavingPrice} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg text-sm transition-colors">{isSavingPrice ? 'Guardando...' : 'Guardar en Base de Datos'}</button>
              </form>
            </div>
            
            <div className="bg-white rounded-xl border shadow-sm col-span-2 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center"><h2 className="font-bold text-gray-800">Precios Globales Guardados</h2></div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white text-gray-500 font-medium border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Ruta Principal</th>
                      <th className="px-4 py-3 text-right">Ida</th>
                      <th className="px-4 py-3 text-right">Ida y Vuelta</th>
                      <th className="px-4 py-3 text-right">15 Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {defaultPrices.map((p: any) => (
                      <tr key={p.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.origin} ↔ {p.destination}</td>
                        <td className="px-4 py-3 text-right text-gray-600">${Number(p.price_one_way).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-purple-700">${Number(p.price_round_trip).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">${Number(p.price_15_days || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: PAQUETERIA --- */}
        {activeTab === 'paqueteria' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6 col-span-1 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Box className="text-orange-600" /> Registrar Paquete</h2>
              <form onSubmit={handleCreateParcel} className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Remitente</label><input type="text" required value={parcelForm.sender} onChange={e => setParcelForm({...parcelForm, sender: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Destinatario</label><input type="text" required value={parcelForm.receiver} onChange={e => setParcelForm({...parcelForm, receiver: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="block text-xs font-bold text-gray-700 mb-1">Origen</label><select value={parcelForm.origin} onChange={e => setParcelForm({...parcelForm, origin: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="flex-1"><label className="block text-xs font-bold text-gray-700 mb-1">Destino</label><select value={parcelForm.destination} onChange={e => setParcelForm({...parcelForm, destination: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1">Costo ($)</label><input type="number" required value={parcelForm.price} onChange={e => setParcelForm({...parcelForm, price: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold text-orange-600" /></div>
                <button type="submit" disabled={isCreatingParcel} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg text-sm mt-2 transition-colors">{isCreatingParcel ? 'Guardando...' : 'Generar Folio'}</button>
              </form>
            </div>
            <div className="bg-white rounded-xl border shadow-sm col-span-2 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center"><h2 className="font-bold text-gray-800">Historial</h2></div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-gray-500 font-medium border-b sticky top-0"><tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Ruta</th><th className="px-4 py-3">Pasajero</th><th className="px-4 py-3 text-right">Cobro</th></tr></thead>
                  <tbody className="divide-y text-gray-800">
                    {parcels.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono font-bold text-orange-700">PAQ-{p.folio}</td><td className="px-4 py-3 text-xs font-medium">{p.origin} a {p.destination}</td><td className="px-4 py-3 truncate">{p.sender_name}</td><td className="px-4 py-3 text-right font-bold">${Number(p.price).toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA: TABLAS DE BOLETOS VENDIDOS / PENDIENTES --- */}
        {(activeTab === 'pagados' || activeTab === 'intentos') && (
          <>
            <div className="bg-white p-4 rounded-xl border shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-4 items-center">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm text-gray-700" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm text-gray-700" />
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-sm text-blue-600 font-bold underline">Ver Todo</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowHistoryModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                  <PlusCircle size={18} /> Registrar Venta Pasada
                </button>
                <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">Exportar a Excel</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center"><h2 className="font-bold text-gray-800">{activeTab === 'pagados' ? 'Transacciones Completadas' : 'Operaciones Pendientes/Canceladas'}</h2></div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white text-gray-500 font-medium border-b sticky top-0 z-10">
                    <tr><th className="px-6 py-4">Ref/Folio</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4">Ruta (Pasajero)</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Fecha/Hora</th><th className="px-6 py-4 text-right">Monto</th><th className="px-6 py-4 text-center">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y text-gray-800">
                    {Object.keys(datosAgrupados).length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No hay registros con estos filtros.</td></tr>
                    ) : (
                      Object.keys(datosAgrupados).map((mes: string) => (
                        <React.Fragment key={mes}>
                          <tr className="bg-gray-100"><td colSpan={8} className="px-6 py-2 font-black text-gray-700 uppercase tracking-wider text-xs">{mes} - ({datosAgrupados[mes].length} Registros)</td></tr>
                          {datosAgrupados[mes].map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-mono font-bold text-blue-900">{item.folio}</td>
                              <td className="px-6 py-4">
                                {item.status === 'pagado' ? <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-bold w-fit"><CheckCircle size={12}/> Pagado</span> :
                                item.status === 'pendiente' ? <span className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-bold w-fit"><Clock size={12}/> Pendiente</span> :
                                <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-bold w-fit"><XCircle size={12}/> Cancelado</span>}
                              </td>
                              <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-semibold">{item.tipo}</span></td>
                              <td className="px-6 py-4 font-medium max-w-[200px] truncate" title={`${item.cliente} (${item.origen} a ${item.destino})`}>
                                <p>{item.cliente}</p>
                                <p className="text-xs text-gray-500 font-normal">{item.origen} a {item.destino}</p>
                              </td>
                              <td className="px-6 py-4 font-medium">{item.metodoPago}</td>
                              <td className="px-6 py-4 text-gray-500">{item.fechaCompleta}</td>
                              <td className="px-6 py-4 text-right font-bold text-gray-900">${Number(item.monto).toLocaleString()}</td>
                              
                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                {item.status === 'pendiente' && (
                                  <button onClick={() => handleMarkAsPaid(item.id, item.folio)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg cursor-pointer transition-colors" title="Confirmar Pago en Efectivo"><CheckSquare size={18} /></button>
                                )}
                                {userRole === 'admin' && (
                                  <button onClick={() => { let currentMethod = 'efectivo'; if (item.metodoPago === 'Tarjeta') currentMethod = 'tarjeta'; if (item.metodoPago === 'Transferencia') currentMethod = 'transferencia'; setEditingPayment({ id: item.id, folio: item.folio, method: currentMethod }); setShowEditPaymentModal(true); }} className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-lg cursor-pointer transition-colors" title="Editar Método de Pago"><CreditCard size={18} /></button>
                                )}
                                <button onClick={() => printTicket(item)} disabled={item.status !== 'pagado'} className={`p-2 rounded-lg ${item.status === 'pagado' ? 'text-blue-600 hover:bg-blue-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`} title="Imprimir Ticket"><Printer size={18} /></button>
                                <button onClick={() => printBoleto(item)} disabled={item.status !== 'pagado'} className={`p-2 rounded-lg ${item.status === 'pagado' ? 'text-purple-600 hover:bg-purple-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`} title="Imprimir Boleto Abordaje"><Ticket size={18} /></button>
                                {userRole === 'admin' && (
                                  <button onClick={() => handleDeleteBooking(item.id, item.folio)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg cursor-pointer transition-colors" title="Eliminar Venta"><Trash2 size={18} /></button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* --- MODAL PARA EDITAR MÉTODO DE PAGO --- */}
        {showEditPaymentModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="bg-yellow-600 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg flex items-center gap-2"><CreditCard /> Editar Pago</h3>
                <button onClick={() => setShowEditPaymentModal(false)} className="text-yellow-200 hover:text-white"><XCircle /></button>
              </div>
              <form onSubmit={handleUpdatePaymentMethod} className="p-6 space-y-4">
                <p className="text-sm text-gray-600">Modificando el método de pago para el folio <strong className="text-gray-900">{editingPayment.folio}</strong></p>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nuevo Método</label>
                  <select value={editingPayment.method} onChange={e => setEditingPayment({...editingPayment, method: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-semibold text-gray-800">
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3 border-t mt-6">
                  <button type="button" onClick={() => setShowEditPaymentModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={isUpdatingPayment} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl transition-colors">{isUpdatingPayment ? 'Guardando...' : 'Guardar Cambios'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL DE REGISTRO HISTÓRICO --- */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
              <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg flex items-center gap-2"><History /> Subir Boleto de Sistema Anterior</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-indigo-200 hover:text-white"><XCircle /></button>
              </div>
              <form onSubmit={handleSaveHistoricalBooking} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Fecha de la Venta</label><input type="date" required value={historyForm.saleDate} onChange={e => setHistoryForm({...historyForm, saleDate: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Fecha del Viaje</label><input type="date" required value={historyForm.tripDate} onChange={e => setHistoryForm({...historyForm, tripDate: e.target.value})} className="w-full border rounded-lg p-2 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Origen</label><select value={historyForm.origin} onChange={e => setHistoryForm({...historyForm, origin: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Destino</label><select value={historyForm.destination} onChange={e => setHistoryForm({...historyForm, destination: e.target.value})} className="w-full border rounded-lg p-2 text-sm">{BONILLA_ROUTE.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Pasajero</label><input type="text" required value={historyForm.name} onChange={e => setHistoryForm({...historyForm, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Ej. María López" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Boleto</label><select value={historyForm.tripType} onChange={e => setHistoryForm({...historyForm, tripType: e.target.value})} className="w-full border rounded-lg p-2 text-sm"><option value="sencillo">Sencillo</option><option value="redondo">Redondo</option><option value="15_dias">15 Días</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Total Pagado ($)</label><input type="number" required value={historyForm.price} onChange={e => setHistoryForm({...historyForm, price: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold text-green-700" placeholder="Ej. 850" /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Asientos (Opcional)</label><input type="text" value={historyForm.seats} onChange={e => setHistoryForm({...historyForm, seats: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Ej. 12, 13" /></div>
                </div>
                <div className="pt-4 flex gap-3 border-t mt-6">
                  <button type="button" onClick={() => setShowHistoryModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSavingHistory} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors">{isSavingHistory ? 'Guardando...' : 'Guardar Boleto Histórico'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
