import { useState, useEffect } from 'react';
import './AvailabilityCalendar.css';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Trash2, Check, Plus } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { isJourFerie } from '../lib/dates';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';

function formatDatabaseDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDatabaseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function AvailabilityCalendar() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'employee';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminEditModalOpen, setIsAdminEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  const [bookingForm, setBookingForm] = useState({ slot: 'Matin', type: 'option', ofName: '', comments: '' });

  useEffect(() => {
    let isActive = true;

    async function loadBookings() {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const [ofResult, learnerResult] = await Promise.all([
        supabase
          .from('calendar_bookings')
          .select('*')
          .gte('date', formatDatabaseDate(monthStart))
          .lte('date', formatDatabaseDate(monthEnd)),
        supabase
          .from('learner_calendar_blocks')
          .select('booking_date, slot')
          .gte('booking_date', formatDatabaseDate(monthStart))
          .lte('booking_date', formatDatabaseDate(monthEnd)),
      ]);

      if (ofResult.error || learnerResult.error) {
        console.error('Erreur lors du chargement des réservations:', {
          organismes: ofResult.error,
          apprenants: learnerResult.error,
        });
      } else if (isActive) {
        const ofBookings = (ofResult.data || []).map((booking) => ({
          ...booking,
          date: parseDatabaseDate(booking.date),
          of: booking.of_name,
          source: 'of',
        }));
        const learnerBlocks = (learnerResult.data || []).map((block) => ({
          id: `learner-${block.booking_date}-${block.slot}`,
          date: parseDatabaseDate(block.booking_date),
          slot: block.slot,
          type: 'formation',
          of: 'Formation apprenant',
          comments: null,
          source: 'learner',
        }));
        setBookings([...ofBookings, ...learnerBlocks]);
      }
    }

    loadBookings();

    return () => {
      isActive = false;
    };
  }, [currentDate]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day, isDisabled) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only admins can click past days, holidays, or Sundays
    if (!isDisabled || isAdmin) {
      const dayBookings = getBookingsForDay(day);
      const isMorningBusy = dayBookings.some((booking) => booking.slot === 'Matin' || booking.slot === 'Journée');
      const isAfternoonBusy = dayBookings.some((booking) => booking.slot === 'Après-midi' || booking.slot === 'Journée');
      const isSaturday = clickedDate.getDay() === 6;
      const availableSlots = [
        !isMorningBusy ? 'Matin' : null,
        (!isSaturday || isAdmin) && !isAfternoonBusy ? 'Après-midi' : null,
        (!isSaturday || isAdmin) && !isMorningBusy && !isAfternoonBusy ? 'Journée' : null,
      ].filter(Boolean);

      if (availableSlots.length === 0) {
        alert('Cette journée ne contient plus de période disponible.');
        return;
      }

      setSelectedDate(clickedDate);
      setIsModalOpen(true);
      // Reset form defaults based on role
      setBookingForm({ 
        slot: availableSlots[0],
        type: isAdmin ? 'confirmé' : 'option', 
        ofName: isAdmin ? 'Indisponibilité' : '', 
        comments: '' 
      });
    }
  };

  const handleBookingClick = (e, booking) => {
    if (!isAdmin || booking.source === 'learner') return; // Les blocs apprenant ne sont pas modifiables ici.
    e.stopPropagation(); // Prevent trigger date click
    setSelectedBooking(booking);
    setIsAdminEditModalOpen(true);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    
    // Format date properly for Postgres
    const dateStr = formatDatabaseDate(selectedDate);

    const newBookingData = {
      date: dateStr,
      slot: bookingForm.slot,
      type: bookingForm.type,
      of_name: bookingForm.ofName,
      comments: bookingForm.comments
    };

    const { data, error } = await supabase
      .from('calendar_bookings')
      .insert([newBookingData])
      .select();
      
    if (error) {
      console.error("Erreur lors de l'ajout :", error);
      alert(error.code === '23505' || error.message?.includes("n'est plus disponible")
        ? "Cette période vient d'être réservée ou contient déjà une séance apprenant. Choisissez un autre créneau."
        : "Une erreur est survenue lors de la réservation.");
      return;
    }
    
    if (data && data.length > 0) {
      const addedBooking = {
        ...data[0],
        date: parseDatabaseDate(data[0].date),
        of: data[0].of_name,
        source: 'of',
      };
      setBookings([...bookings, addedBooking]);
    }
    
    setIsModalOpen(false);
  };

  const handleAdminConfirm = async () => {
    const { error } = await supabase
      .from('calendar_bookings')
      .update({ type: 'confirmé' })
      .eq('id', selectedBooking.id);

    if (error) {
      console.error("Erreur lors de la validation :", error);
      alert("Erreur lors de la validation.");
      return;
    }

    setBookings(bookings.map(b => b.id === selectedBooking.id ? { ...b, type: 'confirmé' } : b));
    setIsAdminEditModalOpen(false);
  };

  const handleAdminDelete = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette réservation ?")) {
      const { error } = await supabase
        .from('calendar_bookings')
        .delete()
        .eq('id', selectedBooking.id);

      if (error) {
        console.error("Erreur lors de la suppression :", error);
        alert("Erreur lors de la suppression.");
        return;
      }

      setBookings(bookings.filter(b => b.id !== selectedBooking.id));
      setIsAdminEditModalOpen(false);
    }
  };

  const getBookingsForDay = (day) => {
    return bookings.filter(b => {
      return b.date.getDate() === day && b.date.getMonth() === currentDate.getMonth() && b.date.getFullYear() === currentDate.getFullYear();
    });
  };

  const selectedDateBookings = selectedDate ? getBookingsForDay(selectedDate.getDate()) : [];
  const selectedMorningBusy = selectedDateBookings.some((booking) => booking.slot === 'Matin' || booking.slot === 'Journée');
  const selectedAfternoonBusy = selectedDateBookings.some((booking) => booking.slot === 'Après-midi' || booking.slot === 'Journée');

  const renderDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const isPast = thisDate < today;
      const ferie = isJourFerie(thisDate);
      const isSunday = thisDate.getDay() === 0;
      const isDisabled = isPast || ferie || isSunday;
      const dayBookings = getBookingsForDay(i);
      
      const isMatinBooked = dayBookings.some(b => b.slot === 'Matin' || b.slot === 'Journée');
      const isApremBooked = dayBookings.some(b => b.slot === 'Après-midi' || b.slot === 'Journée');

      let dayClass = 'calendar-day';
      if (isPast && !ferie && !isSunday) dayClass += ' past';
      if (ferie || isSunday) dayClass += ' ferie';
      if (!isDisabled || isAdmin) dayClass += ' available';

      days.push(
        <div key={i} className={dayClass} onClick={() => (!isDisabled || isAdmin) && handleDateClick(i, isDisabled)}>
          <div className="calendar-date" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {i}
            {ferie && <small style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--color-text-light)' }}>Férié</small>}
            {isSunday && !ferie && <small style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--color-text-light)' }}>Dimanche</small>}
          </div>
          
          <div className="calendar-slots">
            {(!isDisabled || isAdmin) && (
              <>
                {isMatinBooked ? (
                  <div 
                    className={`slot-badge slot-${dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée').type === 'option' ? 'option' : 'booked'}`}
                    onClick={(e) => handleBookingClick(e, dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée'))}
                    style={{ cursor: isAdmin && dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée').source !== 'learner' ? 'pointer' : 'default' }}
                    title={dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée').source === 'learner' ? 'Indisponible : séance apprenant' : isAdmin ? "Cliquez pour gérer" : ""}
                  >
                    Matin ({dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée').source === 'learner' ? 'formation' : dayBookings.find(b => b.slot === 'Matin' || b.slot === 'Journée').type})
                  </div>
                ) : <div className="slot-badge slot-available">Matin libre</div>}
                
                {isApremBooked ? (
                   <div 
                    className={`slot-badge slot-${dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée').type === 'option' ? 'option' : 'booked'}`}
                    onClick={(e) => handleBookingClick(e, dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée'))}
                    style={{ cursor: isAdmin && dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée').source !== 'learner' ? 'pointer' : 'default' }}
                    title={dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée').source === 'learner' ? 'Indisponible : séance apprenant' : isAdmin ? "Cliquez pour gérer" : ""}
                   >
                   A-M ({dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée').source === 'learner' ? 'formation' : dayBookings.find(b => b.slot === 'Après-midi' || b.slot === 'Journée').type})
                 </div>
                ) : <div className="slot-badge slot-available">A-M libre</div>}
              </>
            )}

            {(ferie || isSunday) && isAdmin && (
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <Plus size={16} color="var(--color-primary)" title="Ajouter quand même" />
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <>
      <SEO
        title="Disponibilités & Réservations – FormaPrompt"
        description="Consultez mes disponibilités et réservez des créneaux de formation."
        url="https://formaprompt.com/disponibilites"
      />
      <div className="container section">
      <div className="text-center mb-4">
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <CalendarIcon size={36} color="var(--color-primary)" />
          Disponibilités & Réservations
        </h1>
        {isAdmin ? (
          <p className="text-large" style={{ color: '#ef4444', fontWeight: 'bold' }}>Mode Administrateur Actif</p>
        ) : (
          <p className="text-large">Espace réservé aux Organismes de Formation partenaires.</p>
        )}
        <p>Consultez mes disponibilités et positionnez des options ou des réservations fermes.</p>
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <button onClick={prevMonth}><ChevronLeft size={24} /></button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={nextMonth}><ChevronRight size={24} /></button>
        </div>

        <div className="calendar-grid">
          {dayNames.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {renderDays()}
        </div>

        <div className="legend card">
          <div className="legend-item">
            <div className="legend-color slot-available"></div>
            <span>Créneau Libre</span>
          </div>
          <div className="legend-item">
            <div className="legend-color slot-option"></div>
            <span>Option (Non sûr)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color slot-booked"></div>
            <span>Réservé (Sûr)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-ferie"></div>
            <span>Jour Férié</span>
          </div>
        </div>
      </div>

      {/* MODAL AJOUT RÉSERVATION */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
            <h3 id="modal-title">{isAdmin ? "Bloquer un créneau (Admin)" : "Demander une réservation"}</h3>
            <p className="mb-4">Date : <strong>{selectedDate?.toLocaleDateString('fr-FR')}</strong></p>
            
            <form onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <label>Nom de l'Organisme de Formation (OF) *</label>
                <input 
                  type="text" 
                  required 
                  value={bookingForm.ofName}
                  onChange={e => setBookingForm({...bookingForm, ofName: e.target.value})}
                  placeholder="Ex: CCI France"
                />
              </div>

              <div className="form-group">
                <label>Créneau *</label>
                <select 
                  value={bookingForm.slot} 
                  onChange={e => setBookingForm({...bookingForm, slot: e.target.value})}
                  disabled={!isAdmin && selectedDate?.getDay() === 6}
                >
                  <option value="Matin" disabled={selectedMorningBusy}>Matin (9h-12h30)</option>
                  {(!(!isAdmin && selectedDate?.getDay() === 6)) && (
                    <>
                      <option value="Après-midi" disabled={selectedAfternoonBusy}>Après-midi (13h30-17h)</option>
                      <option value="Journée" disabled={selectedMorningBusy || selectedAfternoonBusy}>Journée complète</option>
                    </>
                  )}
                </select>
                {!isAdmin && selectedDate?.getDay() === 6 && (
                  <small style={{ color: 'var(--color-text-light)', display: 'block', marginTop: '0.25rem' }}>
                    <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                    Le samedi, seul le créneau du matin est disponible à la réservation.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Type de réservation *</label>
                <select 
                  value={bookingForm.type} 
                  onChange={e => setBookingForm({...bookingForm, type: e.target.value})}
                >
                  <option value="option">Option (Non sûr / À confirmer)</option>
                  {isAdmin && <option value="confirmé">Réservation ferme (Sûr)</option>}
                </select>
                {!isAdmin && (
                  <small style={{ color: 'var(--color-text-light)', display: 'block', marginTop: '0.25rem' }}>
                    <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                    Votre demande est enregistrée comme option pendant 48 h. FormaPrompt la confirme ensuite avec vous.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Commentaires / Sujet de formation</label>
                <textarea 
                  rows="3" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                  value={bookingForm.comments}
                  onChange={e => setBookingForm({...bookingForm, comments: e.target.value})}
                  placeholder="Thème, public, adresse..."
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} onClick={() => setIsModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ÉDITION ADMIN */}
      {isAdminEditModalOpen && selectedBooking && (
        <div className="modal-overlay" onClick={() => setIsAdminEditModalOpen(false)}>
          <div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" onClick={e => e.stopPropagation()}>
            <h3 id="edit-modal-title">Gérer la réservation</h3>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
              <p><strong>Date :</strong> {selectedBooking.date.toLocaleDateString('fr-FR')}</p>
              <p><strong>Créneau :</strong> {selectedBooking.slot}</p>
              <p><strong>Client / OF :</strong> {selectedBooking.of}</p>
              <p><strong>Statut actuel :</strong> <span className={`slot-badge slot-${selectedBooking.type === 'option' ? 'option' : 'booked'}`}>{selectedBooking.type}</span></p>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ef4444', color: 'white' }} 
                onClick={handleAdminDelete}
              >
                <Trash2 size={18} />
                Supprimer
              </button>
              
              {selectedBooking.type === 'option' && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleAdminConfirm}
                >
                  <Check size={18} />
                  Valider définitivement
                </button>
              )}
            </div>
            
            <div className="text-center" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn" style={{ background: 'transparent', color: 'var(--color-text)' }} onClick={() => setIsAdminEditModalOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
