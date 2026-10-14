import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
    Search, 
    Calendar, 
    Wallet, 
    CreditCard, 
    Mail, 
    CheckCircle, 
    CheckCircle2, 
    Clock, 
    Send, 
    Eye, 
    Loader2, 
    MessageCircle 
} from 'lucide-react';

const Payments = () => {
    const { records, students, classes, getPendingReminders, triggerManualReminders, markWAReminderSent } = useAppContext();
    const [monthFilter, setMonthFilter] = useState(''); // Empty means last 2 months
    const [searchTerm, setSearchTerm] = useState('');

    // Estado para la sección de Recordatorios y Alumnos Deudores
    const [reminderMonth, setReminderMonth] = useState(new Date().getMonth());
    const [reminderYear, setReminderYear] = useState(new Date().getFullYear());
    const [pendingReminders, setPendingReminders] = useState(null);
    const [isLoadingPending, setIsLoadingPending] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [expandedDebtor, setExpandedDebtor] = useState(null);
    const [debtTypeFilter, setDebtTypeFilter] = useState('all'); // 'all', 'classes', 'practices'

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const handleLoadPendingReminders = async (yearMonthOverride) => {
        const mStr = (reminderMonth + 1).toString().padStart(2, '0');
        const targetYearMonth = yearMonthOverride || `${reminderYear}-${mStr}`;
        setIsLoadingPending(true);
        try {
            const res = await getPendingReminders({ monthPrefix: targetYearMonth });
            if (res.data.success) {
                setPendingReminders(res.data.students);
            } else {
                alert("Error al cargar lista: " + res.data.message);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al consultar alumnos pendientes.");
        } finally {
            setIsLoadingPending(false);
        }
    };

    const handleMonthChange = (newMonth, newYear) => {
        setReminderMonth(newMonth);
        setReminderYear(newYear);
        const mStr = (newMonth + 1).toString().padStart(2, '0');
        const newYearMonth = `${newYear}-${mStr}`;
        if (pendingReminders !== null) {
            handleLoadPendingReminders(newYearMonth);
        }
    };

    const handleSendManualReminders = async () => {
        if (!pendingReminders || pendingReminders.length === 0) return;
        const monthName = months[reminderMonth];
        const mStr = (reminderMonth + 1).toString().padStart(2, '0');
        const targetYearMonth = `${reminderYear}-${mStr}`;
        if (window.confirm(`¿Estás seguro de enviar recordatorios REALES por email a los ${pendingReminders.length} alumnos de la lista de ${monthName} ${reminderYear}?`)) {
            setIsSending(true);
            try {
                const res = await triggerManualReminders({ monthPrefix: targetYearMonth });
                if (res.data.success) {
                    alert(`¡Proceso completado! Se enviaron ${res.data.count} recordatorios.`);
                    setPendingReminders(null);
                } else {
                    alert("Error en el envío: " + res.data.message);
                }
            } catch (e) {
                console.error(e);
                alert("Error durante el envío masivo.");
            } finally {
                setIsSending(false);
            }
        }
    };

    // Generamos lista de meses disponibles para el filtro de pagos registrados
    const availableMonths = [...new Set(records.map(r => r.date.substring(0, 7)))].sort((a, b) => b.localeCompare(a));

    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    const filteredRecords = records
        .filter(r => {
            const amount = Number(r.paymentAmount);
            if (amount <= 0) return false;
            
            // Filtro por Mes
            let matchesMonth = false;
            if (monthFilter) {
                matchesMonth = r.date.startsWith(monthFilter);
            } else {
                matchesMonth = r.date.startsWith(currentMonth) || r.date.startsWith(lastMonth);
            }
            if (!matchesMonth) return false;

            // Filtro por Alumno
            if (searchTerm) {
                const student = students.find(s => s.id === r.studentId);
                return student?.name.toLowerCase().includes(searchTerm.toLowerCase());
            }

            return true;
        })
        .sort((a, b) => {
            // 1. Prioridad: Fecha de la clase (descendente)
            if (a.date !== b.date) return b.date.localeCompare(a.date);

            // 2. Segunda prioridad: Hora de la clase (descendente, ej: 21:00 > 19:30)
            const classA = classes.find(c => c.id === a.classId);
            const classB = classes.find(c => c.id === b.classId);
            const timeA = classA?.time || '00:00';
            const timeB = classB?.time || '00:00';
            if (timeA !== timeB) return timeB.localeCompare(timeA);

            // 3. Tercera prioridad: Última actualización (descendente)
            return (b.updatedAt || b.date).localeCompare(a.updatedAt || a.date);
        });

    return (
        <div className="payments-page">
            {/* 1. SECCIÓN DE RECORDATORIOS Y COBRO PENDIENTE */}
            <div className="card" style={{ marginBottom: '25px', border: '1px solid rgba(52, 152, 219, 0.3)', background: 'rgba(52, 152, 219, 0.05)', padding: '20px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#3498db', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Send size={20} /> Recordatorios de Mensualidad
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                    {/* Columna Izquierda: Acciones y Selector de Mes */}
                    <div>
                        <p style={{ margin: '0 0 15px 0', fontSize: '14px', opacity: 0.8, lineHeight: '1.5' }}>
                            Desde aquí puedes controlar el envío de los recordatorios que normalmente se envían el día 7 de cada mes.
                        </p>

                        {/* Selector del mes que quiero chequear */}
                        <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <label style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={13} color="#3498db" /> Mes a Consultar:
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    value={reminderMonth}
                                    onChange={(e) => handleMonthChange(parseInt(e.target.value), reminderYear)}
                                    style={{ 
                                        flex: 1.6, 
                                        marginBottom: 0, 
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(52, 152, 219, 0.4)',
                                        borderRadius: '6px',
                                        color: 'white'
                                    }}
                                >
                                    {months.map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                                <select
                                    value={reminderYear}
                                    onChange={(e) => handleMonthChange(reminderMonth, parseInt(e.target.value))}
                                    style={{ 
                                        flex: 1, 
                                        marginBottom: 0, 
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(52, 152, 219, 0.4)',
                                        borderRadius: '6px',
                                        color: 'white'
                                    }}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={() => handleLoadPendingReminders()}
                                disabled={isLoadingPending}
                                className="btn btn-secondary"
                                style={{ 
                                    justifyContent: 'center', 
                                    padding: '12px', 
                                    fontWeight: '600',
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    fontSize: '12px',
                                    letterSpacing: '0.5px'
                                }}
                            >
                                {isLoadingPending ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
                                VER ALUMNOS CON COBRO PENDIENTE ({months[reminderMonth].toUpperCase()})
                            </button>

                            {pendingReminders && pendingReminders.length > 0 && (
                                <button 
                                    onClick={handleSendManualReminders}
                                    disabled={isSending}
                                    className="btn"
                                    style={{ 
                                        backgroundColor: '#e74c3c', color: 'white', border: 'none', 
                                        justifyContent: 'center', padding: '14px', fontWeight: 'bold' 
                                    }}
                                >
                                    {isSending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                                    ENVIAR RECORDATORIOS AHORA ({months[reminderMonth].toUpperCase()})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Columna Derecha: Lista Previsualizada */}
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '20px', minHeight: '160px', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Alumnos Deudores ({months[reminderMonth]} {reminderYear})
                            </h4>
                            {pendingReminders && (
                                <span style={{ fontSize: '11px', color: pendingReminders.length > 0 ? '#e74c3c' : '#2ecc71', fontWeight: 'bold' }}>
                                    {pendingReminders.length === 1 ? '1 pendiente' : `${pendingReminders.length} pendientes`}
                                </span>
                            )}
                        </div>
                        
                        {pendingReminders === null ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p style={{ fontSize: '13px', opacity: 0.4, textAlign: 'center', margin: '20px 0' }}>
                                    Haz clic en "Ver alumnos" para cargar la lista.
                                </p>
                            </div>
                        ) : pendingReminders.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                                <CheckCircle2 size={38} color="#2ecc71" style={{ marginBottom: '10px', opacity: 0.7 }} />
                                <p style={{ fontSize: '14px', color: '#2ecc71', margin: 0, fontWeight: '500' }}>¡Todos los alumnos tienen sus pagos al día en {months[reminderMonth]}!</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-10" style={{ marginBottom: '15px' }}>
                                    <button 
                                        type="button"
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('all')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'all' ? '#3498db' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'all' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', fontWeight: 'bold', borderRadius: '6px'
                                        }}
                                    >TODOS ({pendingReminders.length})</button>
                                    <button 
                                        type="button"
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('classes')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'classes' ? '#3498db' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'classes' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', fontWeight: 'bold', borderRadius: '6px'
                                        }}
                                    >DEUDAS CLASES ({pendingReminders.filter(s => s.classDebt > 0).length})</button>
                                    <button 
                                        type="button"
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('practices')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'practices' ? '#f1c40f' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'practices' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: debtTypeFilter === 'practices' ? 'black' : 'white', fontWeight: 'bold', borderRadius: '6px'
                                        }}
                                    >DEUDAS PRÁCTICAS ({pendingReminders.filter(s => s.practiceDebt > 0).length})</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                                    {pendingReminders
                                        .filter(s => {
                                            if (debtTypeFilter === 'classes') return s.classDebt > 0;
                                            if (debtTypeFilter === 'practices') return s.practiceDebt > 0;
                                            return true;
                                        })
                                        .map(s => {
                                            const fullStudent = students.find(st => st.id === s.id);
                                            return (
                                                <div 
                                                    key={s.id} 
                                                    onClick={() => setExpandedDebtor(expandedDebtor === s.id ? null : s.id)}
                                                    className="flex flex-column" 
                                                    style={{ 
                                                        padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', 
                                                        fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                                                        border: expandedDebtor === s.id ? '1px solid rgba(52, 152, 219, 0.4)' : '1px solid transparent'
                                                    }}
                                                >
                                                    <div className="flex justify-between align-center">
                                                        <span style={{ fontWeight: '600', color: expandedDebtor === s.id ? '#3498db' : 'inherit' }} spellCheck="false" autoCorrect="off" autoCapitalize="none">{s.name}</span>
                                                        <span style={{ fontSize: '11px', opacity: 0.5 }}>{s.email}</span>
                                                    </div>
                                                    <div className="flex justify-between align-center" style={{ marginTop: '5px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#e74c3c' }}>${s.totalOwed}</span>
                                                        <div className="flex gap-5 align-center">
                                                            {s.classDebt > 0 && <span style={{ fontSize: '9px', backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', border: '1px solid rgba(52, 152, 219, 0.2)' }}>CLASES: ${s.classDebt}</span>}
                                                            {s.practiceDebt > 0 && <span style={{ fontSize: '9px', backgroundColor: 'rgba(241, 196, 15, 0.1)', color: '#f1c40f', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', border: '1px solid rgba(241, 196, 15, 0.2)' }}>PRÁCTICAS: ${s.practiceDebt}</span>}
                                                            {fullStudent?.phone && (
                                                                <a
                                                                    href={`https://wa.me/${fullStudent.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${s.name}!\n\n¿Cómo estás? Te escribimos de Ventarrón para recordarte que el saldo del mes de ${months[reminderMonth]} quedó pendiente ($${s.totalOwed}).\n\nSi ya transferiste, por favor envíanos el comprobante.\n\n¡Muchas gracias y nos vemos en pista!`)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        markWAReminderSent(s.id);
                                                                    }}
                                                                    style={{
                                                                        fontSize: '9px',
                                                                        backgroundColor: 'rgba(46, 204, 113, 0.15)',
                                                                        color: '#2ecc71',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        fontWeight: '700',
                                                                        border: '1px solid rgba(46, 204, 113, 0.3)',
                                                                        textDecoration: 'none',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '3px'
                                                                    }}
                                                                    title="Enviar recordatorio por WhatsApp"
                                                                >
                                                                    <MessageCircle size={10} /> WA
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {expandedDebtor === s.id && (s.attendanceDetails || s.attendanceDates) && (
                                                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <p style={{ margin: 0, fontSize: '10px', opacity: 0.6, color: '#3498db', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                Asistencias sin pago ({months[reminderMonth]}):
                                                            </p>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                {s.attendanceDetails ? (
                                                                    s.attendanceDetails.map((det, dIdx) => (
                                                                        <div key={`${det.date}-${det.className}-${dIdx}`} style={{ 
                                                                            backgroundColor: det.isPractice ? 'rgba(241, 196, 15, 0.15)' : 'rgba(52, 152, 219, 0.15)', 
                                                                            color: det.isPractice ? '#f1c40f' : '#3498db', 
                                                                            padding: '5px 10px', borderRadius: '6px', fontSize: '11px', 
                                                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                                            border: `1px solid ${det.isPractice ? 'rgba(241, 196, 15, 0.2)' : 'rgba(52, 152, 219, 0.2)'}`
                                                                        }}>
                                                                            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{new Date(det.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}</span>
                                                                            <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', fontWeight: '600', marginTop: '2px' }}>{det.className}</span>
                                                                        </div>
                                                                    ))
                                                                ) : s.attendanceDates && s.attendanceDates.length > 0 ? (
                                                                    s.attendanceDates.map(date => (
                                                                        <span key={date} style={{ backgroundColor: 'rgba(52, 152, 219, 0.15)', color: '#3498db', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                                                            {new Date(date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span style={{ fontSize: '11px', opacity: 0.5 }}>No se encontraron asistencias registradas.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. BUSCADOR Y FILTROS DE LISTA DE PAGOS */}
            <div className="flex justify-between align-center" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                {/* BUSCADOR DE ALUMNO */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, flex: '1 1 300px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Search size={20} opacity={0.5} />
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', marginBottom: '5px' }}>Buscar por Alumno</label>
                        <input 
                            type="text"
                            placeholder="Ej: Juan Pérez..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ marginBottom: 0, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '5px 0' }}
                        />
                    </div>
                </div>

                {/* FILTRO DE MES */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, flex: '1 1 300px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Calendar size={20} opacity={0.5} />
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', marginBottom: '5px' }}>Ver Período</label>
                        <select 
                            value={monthFilter} 
                            onChange={(e) => setMonthFilter(e.target.value)}
                            style={{ marginBottom: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <option value="">Últimos 2 meses</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    {new Date(m + '-02T12:00:00').toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '600px' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <tr>
                                <th style={{ padding: '15px' }}>Fecha</th>
                                <th>Alumno</th>
                                <th>Clase</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Método</th>
                                <th style={{ textAlign: 'center' }}>Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((r, idx) => {
                                const student = students.find(s => s.id === r.studentId) || { name: 'Alumno eliminado' };
                                const cls = classes.find(c => c.id === r.classId) || { name: 'Clase eliminada' };
                                const amount = Number(r.paymentAmount);
                                
                                let concept = "Clase Suelta";
                                if (amount === Number(cls.monthlyPrice)) concept = "Mensual 1xS";
                                else if (amount === Number(cls.monthly2xsPrice)) concept = "Mensual 2xS";

                                return (
                                    <tr key={`${r.studentId}-${r.date}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 15px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {new Date(r.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                                        <td style={{ fontSize: '12px', opacity: 0.7 }}>{cls.name}</td>
                                        <td>
                                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '10px', opacity: 0.6 }}>
                                                {concept}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: '#2ecc71' }}>${amount}</td>
                                        <td>
                                            <div className="flex align-center gap-5" style={{ fontSize: '11px', opacity: 0.8 }}>
                                                {r.paymentMethod === 'transfer' ? <CreditCard size={14} color="#3498db" /> : <Wallet size={14} color="#2ecc71" />}
                                                {r.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.receiptSent ? (
                                                <div className="flex align-center justify-center gap-5" style={{ color: '#2ecc71', fontSize: '11px' }}>
                                                    <CheckCircle size={16} /> 
                                                </div>
                                            ) : (
                                                <Clock size={16} opacity={0.2} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>
                                        {searchTerm ? `No hay registros de pago para "${searchTerm}".` : 'No se registran pagos en este período.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Payments;
