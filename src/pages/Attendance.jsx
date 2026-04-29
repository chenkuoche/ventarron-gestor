import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import {
    CircleCheck,
    Wallet,
    CreditCard,
    Save,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Circle,
    Search,
    UserMinus,
    Mail,
    Loader2,
    CheckCircle,
    CalendarOff,
    XCircle,
    History,
    Phone,
    Calendar,
    PlusCircle,
    MessageCircle,
    Copy,
    DollarSign,
    Users,
    EyeOff,
    Cake
} from 'lucide-react';

const Attendance = () => {
    const { students, classes, records, saveAttendanceAndPayment, updateStudent, hasUnsavedChanges, setHasUnsavedChanges, selectedClassId, setSelectedClassId, selectedDate, setSelectedDate, sendEmail, markReceiptSent, markWAReceiptSent, markWAReminderSent } = useAppContext();
    const [confirmModal, setConfirmModal] = useState(null); // { title: string, message: string, onConfirm: () => void }
    const [studentRecords, setStudentRecords] = useState({});
    const [searchExtra, setSearchExtra] = useState('');
    const [extraData, setExtraData] = useState({}); // { studentId: 'recovery' | 'guest' }
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [pendingAction, setPendingAction] = useState(null); // { type: 'exit' | 'date', value?: string }
    const [idsToDelete, setIdsToDelete] = useState([]); // Alumnos quitados de la lista (para borrar de Firestore)
    const [emailStatus, setEmailStatus] = useState({}); // { studentId: 'sending' | 'sent' | 'error' }
    const [forceOpen, setForceOpen] = useState(false);
    const [viewHistory, setViewHistory] = useState(null);
    const [countdown, setCountdown] = useState(5); // Contador para autoguardado
    const [answeredPracticePayment, setAnsweredPracticePayment] = useState(new Set());
    const [showOnlyPending, setShowOnlyPending] = useState(false);
    const [showPracticesList, setShowPracticesList] = useState(false);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const lastRemoteSync = React.useRef(null);

    // 1. CARGAR de la base de datos
    useEffect(() => {
        if (selectedClassId && selectedDate) {
            if (hasUnsavedChanges) return;

            const existing = records.filter(r => r.date === selectedDate && r.classId === selectedClassId);
            const initial = {};
            const existingExtra = {};

            students.forEach(s => {
                const record = existing.find(r => r.studentId === s.id);
                if (record) {
                    initial[s.id] = {
                        present: record.present || false,
                        paymentAmount: record.paymentAmount || 0,
                        paymentMethod: record.paymentMethod || '',
                        receiptSent: record.receiptSent || false,
                        waReceiptSent: record.waReceiptSent || false
                    };
                    if (record.isGuest) existingExtra[s.id] = 'guest';
                    else if (record.isPL) existingExtra[s.id] = 'pl';
                    else if (record.isRecovery) existingExtra[s.id] = 'recovery';
                    else if (!(s.enrolledClasses || []).includes(selectedClassId)) {
                        existingExtra[s.id] = 'recovery'; // Fallback
                    }
                } else if ((s.enrolledClasses || []).includes(selectedClassId)) {
                    initial[s.id] = {
                        present: false,
                        paymentAmount: 0,
                        paymentMethod: '',
                        receiptSent: false,
                        waReceiptSent: false
                    };
                } else if ((s.guestClasses || []).includes(selectedClassId)) {
                    initial[s.id] = {
                        present: false,
                        paymentAmount: 0,
                        paymentMethod: '',
                        receiptSent: false,
                        waReceiptSent: false
                    };
                    existingExtra[s.id] = 'guest';
                }
            });

            if (existing.find(r => r.studentId === 'NO_CLASS')) {
                initial['NO_CLASS'] = { present: false, paymentAmount: 0, paymentMethod: '', receiptSent: false, waReceiptSent: false };
            }

            const remoteHash = JSON.stringify(initial) + JSON.stringify(existingExtra);
            if (remoteHash !== lastRemoteSync.current) {
                lastRemoteSync.current = remoteHash;
                setStudentRecords(initial);
                setExtraData(existingExtra);
            }
        }
    }, [selectedClassId, selectedDate, records, students, hasUnsavedChanges]);

    // Resetear al cambiar de clase o fecha
    useEffect(() => {
        setIdsToDelete([]);
        setEmailStatus({});
        setForceOpen(false);
        lastRemoteSync.current = null;
    }, [selectedClassId, selectedDate]);

    // 1b. Aviso de cambios sin guardar al cerrar pestaña
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ''; // Muestra el mensaje estándar del navegador
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // 1c. Lógica de AUTOGUARDADO con contador visual
    useEffect(() => {
        if (!hasUnsavedChanges || isSaving || !selectedClassId) {
            setCountdown(5);
            return;
        }

        // Cada vez que cambian los datos, reiniciamos el contador a 5
        setCountdown(5);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleSave();
                    return 5;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [hasUnsavedChanges, studentRecords, extraData, idsToDelete, selectedClassId, selectedDate, isSaving]);

    const handleSave = async () => {
        if (!selectedClassId || isSaving) return false;
        setIsSaving(true);
        setFeedbackMsg('Enviando...');
        
        const finalRecords = {};
        Object.keys(studentRecords).forEach(id => {
            finalRecords[id] = {
                ...studentRecords[id],
                isGuest: extraData[id] === 'guest',
                isRecovery: extraData[id] === 'recovery',
                isPL: extraData[id] === 'pl'
            };
        });

        try {
            await saveAttendanceAndPayment(selectedDate, selectedClassId, finalRecords, idsToDelete);
            setHasUnsavedChanges(false);
            setIdsToDelete([]);
            setIsSaving(false);
            setFeedbackMsg('¡GUARDADO! ✅');
            setTimeout(() => setFeedbackMsg(''), 3000);
            return true;
        } catch (error) {
            console.error(error);
            setFeedbackMsg('❌ Error al guardar');
            setIsSaving(false);
            setTimeout(() => setFeedbackMsg(''), 5000);
            return false;
        }
    };

    const handleSendReceipt = async (student, record) => {
        if (!student.email) {
            alert("Este alumno no tiene correo electrónico registrado.");
            return;
        }
        
        const amount = Number(record.paymentAmount);
        if (amount <= 0) return;

        setEmailStatus(prev => ({ ...prev, [student.id]: 'sending' }));

        const selectedClass = classes.find(c => c.id === selectedClassId);
        
        let concept = "";
        if (amount === Number(selectedClass.monthlyPrice)) concept = "la mensualidad correspondiente a una clase semanal";
        else if (amount === Number(selectedClass.monthly2xsPrice)) concept = "la mensualidad correspondiente a dos clases semanales";
        else concept = `la clase del día ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-UY')}`;

        const html = `
            <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 25px;">
                    <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
                <p>Hola <strong>${student.name}</strong>,</p>
                <p>Confirmamos que hemos recibido la suma de <strong>$${amount}</strong> por concepto de <strong>${concept}</strong>.</p>
                <p>Muchas gracias por elegirnos y por compartir el baile con nosotros.</p>
                <br/>
                <p style="text-align: center; font-style: italic;">¡Nos vemos en pista! 💃✨</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
                <p style="font-size: 11px; opacity: 0.5; text-align: center;">Este es un recibo digital automático de Ventarrón Escuela de Tango.</p>
            </div>
        `;

        try {
            await sendEmail({
                to: student.email,
                subject: `Recibo de Pago - Ventarrón Tango`,
                html: html
            });
            
            // Marcar en Firestore permanentemente
            await markReceiptSent(selectedDate, selectedClassId, student.id);
            
            // Actualizar estado local para evitar sobreescritura al guardar
            setStudentRecords(prev => ({
                ...prev,
                [student.id]: {
                    ...prev[student.id],
                    receiptSent: true
                }
            }));

            setEmailStatus(prev => ({ ...prev, [student.id]: 'sent' }));
            setTimeout(() => {
                setEmailStatus(prev => ({ ...prev, [student.id]: 'done' }));
            }, 5000);
        } catch (error) {
            console.error(error);
            setEmailStatus(prev => ({ ...prev, [student.id]: 'error' }));
            alert("Error al enviar el mail. Verifique la conexión.");
        }
    };

    const handleSendWA = (student, type, data = {}) => {
        const phoneRaw = student.phone || '';
        const phone = phoneRaw.replace(/\D/g, '');
        if (!phone) {
            alert("Este alumno no tiene teléfono registrado.");
            return;
        }

        const currentMonthName = months[new Date().getMonth()];
        const selClass = classes.find(c => c.id === selectedClassId) || classes.find(c => (student.enrolledClasses || []).includes(c.id));

        let text = "";
        if (type === 'debt') {
            const price = selClass ? ((student.enrolledClasses || []).length > 1 ? selClass.monthly2xsPrice : selClass.monthlyPrice) : "---";
            text = `Hola ${student.name}!\n\n¿Cómo estás? Te escribimos de Ventarrón para recordarte que el saldo del mes de ${currentMonthName} para la clase de ${selClass?.name || 'tango'} quedó pendiente ($${price}).\n\nSi ya transferiste, por favor envíanos el comprobante.\n\n¡Nos vemos en pista!`;
        } else if (type === 'receipt') {
            const amount = Number(data.amount);
            let concept = "";
            if (selClass) {
                if (amount === Number(selClass.monthlyPrice)) concept = "la mensualidad correspondiente a una clase semanal";
                else if (amount === Number(selClass.monthly2xsPrice)) concept = "la mensualidad correspondiente a dos clases semanales";
                else concept = `la clase del día ${new Date(data.date + 'T12:00:00').toLocaleDateString('es-UY')}`;
            } else {
                concept = "tus clases de tango";
            }
            text = `Hola ${student.name}!\n\nRecibimos correctamente tu pago de $${amount} por concepto de ${concept}.\n\n¡Muchas gracias por elegirnos y nos vemos pronto!`;
        }

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');

        // Marcar como enviado si corresponde
        if (type === 'debt') {
            markWAReminderSent(student.id);
            if (viewHistory && viewHistory.id === student.id) {
                setViewHistory(prev => ({ ...prev, waReminderSentAt: new Date().toISOString() }));
            }
        } else if (type === 'receipt' && data.date) {
            markWAReceiptSent(data.date, data.classId || selectedClassId, student.id);
            setStudentRecords(prev => ({
                ...prev,
                [student.id]: {
                    ...(prev[student.id] || {}),
                    waReceiptSent: true
                }
            }));
            setHasUnsavedChanges(true);
        }
    };

    const handleExit = () => {
        if (hasUnsavedChanges) setPendingAction({ type: 'exit' });
        else setSelectedClassId('');
    };

    const handleDateChange = (newDate) => {
        if (hasUnsavedChanges) setPendingAction({ type: 'date', value: newDate });
        else setSelectedDate(newDate);
    };

    const moveDate = (days) => {
        const date = new Date(selectedDate + 'T12:00:00');
        date.setDate(date.getDate() + days);
        handleDateChange(date.toISOString().split('T')[0]);
    };

    const toggleNoClass = async () => {
        const isCurrentlyNoClass = studentRecords['NO_CLASS'];
        if (isCurrentlyNoClass) {
            // Quitar marca de No Clase
            if (window.confirm("¿Deseas volver a habilitar esta fecha como día de clase?")) {
                setHasUnsavedChanges(true);
                const newStudentRecords = { ...studentRecords };
                delete newStudentRecords['NO_CLASS'];
                setStudentRecords(newStudentRecords);
                setIdsToDelete(prev => [...new Set([...prev, 'NO_CLASS'])]);
            }
        } else {
            // Marcar como No Clase
            if (window.confirm("¿Estás seguro de marcar este día como 'SIN CLASE'? No se computará el alquiler en los reportes.")) {
                setHasUnsavedChanges(true);
                // Ponemos todos los que estaban en idsToDelete para que se borren y solo quede NO_CLASS
                const currentlyVisible = Object.keys(studentRecords);
                setIdsToDelete(prev => [...new Set([...prev, ...currentlyVisible])]);
                setStudentRecords({ 'NO_CLASS': { present: false, paymentAmount: 0, paymentMethod: '' } });
                setExtraData({});
            }
        }
    };

    const confirmAction = async (shouldSave) => {
        if (shouldSave) {
            const success = await handleSave();
            if (!success) return;
        }
        
        const action = pendingAction;
        setPendingAction(null);
        setHasUnsavedChanges(false);
        
        if (action.type === 'exit') {
            setSelectedClassId('');
        } else if (action.type === 'date') {
            setSelectedDate(action.value);
        }
    };

    const togglePresence = (studentId) => {
        setHasUnsavedChanges(true);

        // Si es práctica, reseteamos la respuesta de si pagó o no para que vuelvan a aparecer los botones si se marca de nuevo
        if (selectedClass?.isPractice) {
            setAnsweredPracticePayment(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
        }

        setStudentRecords(prev => {
            const current = prev[studentId] || { present: false, paymentAmount: 0, paymentMethod: '', receiptSent: false };
            const newState = !current.present;
            
            return {
                ...prev,
                [studentId]: { 
                    ...current,
                    present: newState,
                }
            };
        });
    };

    const handleValueChange = (studentId, field, value) => {
        setHasUnsavedChanges(true);
        setStudentRecords(prev => {
            const current = prev[studentId];
            const updates = { [field]: value };
            if (field === 'paymentAmount' && (value === 0 || value === '0' || value === '')) {
                updates.paymentMethod = '';
            } else if (field === 'paymentAmount' && Number(value) > 0 && !current.paymentMethod) {
                const historicP = records.filter(r => r.studentId === studentId && Number(r.paymentAmount) > 0).sort((a,b) => b.date.localeCompare(a.date))[0];
                updates.paymentMethod = historicP ? historicP.paymentMethod : 'cash';
            }
            return {
                ...prev,
                [studentId]: { ...current, ...updates }
            };
        });
    };

    const addExtraStudent = (student, type) => {
        setHasUnsavedChanges(true);
        const selectedClass = classes.find(c => c.id === selectedClassId);
        const plPrice = selectedClass?.plPrice || 249;
        
        setStudentRecords(prev => ({
            ...prev,
            [student.id]: { 
                present: true, 
                paymentAmount: type === 'pl' ? plPrice : 0, 
                paymentMethod: type === 'pl' ? 'transfer' : '', 
                receiptSent: false 
            }
        }));
        setExtraData(prev => ({ ...prev, [student.id]: type }));
        setSearchExtra('');
    };

    const handlePreloadAll = () => {
        if (window.confirm("¿Deseas precargar a todos los alumnos en la lista? (Aparecerán sin marcar asistencia)")) {
            setHasUnsavedChanges(true);
            const newRecords = { ...studentRecords };
            const newExtraData = { ...extraData };
            
            students.forEach(s => {
                if (!newRecords[s.id]) {
                    newRecords[s.id] = { present: false, paymentAmount: 0, paymentMethod: '', receiptSent: false };
                    newExtraData[s.id] = 'event';
                }
            });
            
            setStudentRecords(newRecords);
            setExtraData(newExtraData);
        }
    };


    const enrollStudent = (student) => {
        setHasUnsavedChanges(true);
        const newEnrolled = [...(student.enrolledClasses || []), selectedClassId];
        updateStudent(student.id, { enrolledClasses: newEnrolled });
        setStudentRecords(prev => ({
            ...prev,
            [student.id]: { present: true, paymentAmount: 0, paymentMethod: '', receiptSent: false }
        }));
        setSearchExtra('');
    };

    const removeExtra = (id, skipConfirm = false) => {
        const student = students.find(s => s.id === id);
        const isEnrolled = (student?.enrolledClasses || []).includes(selectedClassId);
        const isGuestStatus = (student?.guestClasses || []).includes(selectedClassId);
        
        const action = () => {
            setHasUnsavedChanges(true);
            
            // 1. Si está anotado en el grupo (regular o invitado), lo quitamos permanentemente
            if (student && (isEnrolled || isGuestStatus)) {
                const updates = {};
                if (isEnrolled) updates.enrolledClasses = (student.enrolledClasses || []).filter(cid => cid !== selectedClassId);
                if (isGuestStatus) updates.guestClasses = (student.guestClasses || []).filter(cid => cid !== selectedClassId);
                updateStudent(student.id, updates);
            }

            // 2. Limpiar de la lista de hoy
            setStudentRecords(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setIdsToDelete(prev => [...new Set([...prev, id])]);
            setExtraData(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setConfirmModal(null);
        };

        if (skipConfirm) {
            action();
        } else {
            setConfirmModal({
                title: 'Quitar Alumno',
                message: (isEnrolled || isGuestStatus)
                    ? `¿Deseas QUITAR permanentemente a ${student?.name || 'alumno'} de este grupo? Ya no aparecerá en la lista regular.` 
                    : `¿Deseas quitar a ${student?.name || 'alumno'} de la lista de hoy?`,
                onConfirm: action
            });
        }
    };

    // Si no hay clase seleccionada, mostrar selector
    if (!selectedClassId) {
        const regularGroups = classes.filter(c => !c.isPractice);
        const specialEvents = classes.filter(c => c.isPractice).sort((a,b) => b.date.localeCompare(a.date));

        return (
            <div className="attendance-select">
                <h3 style={{ marginBottom: '20px' }}>{showPracticesList ? 'Prácticas y Eventos' : 'Seleccione una clase'}</h3>
                
                {!showPracticesList ? (
                    <>
                        {regularGroups.length > 0 && (
                            <>
                                <p style={{ fontSize: '11px', opacity: 0.5, letterSpacing: '1px', marginBottom: '15px' }}>GRUPOS REGULARES</p>
                                <div className="grid-classes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                                    {regularGroups.map(cls => (
                                        <div key={cls.id} className="card flex justify-between align-center" onClick={() => setSelectedClassId(cls.id)} style={{ cursor: 'pointer', transition: 'transform 0.2s ease', padding: '15px' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '11px', opacity: 0.5, textTransform: 'uppercase' }}>{cls.day} {cls.time}hs</p>
                                                <h3 style={{ margin: '5px 0', fontSize: '1.2rem' }}>{cls.name}</h3>
                                            </div>
                                            <ChevronRight size={20} opacity={0.3} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        {specialEvents.length > 0 && (
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setShowPracticesList(true)}
                                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '14px', border: '1px solid rgba(241, 196, 15, 0.3)', color: '#f1c40f', background: 'rgba(241, 196, 15, 0.05)', transition: 'background-color 0.2s' }}
                            >
                                <Calendar size={18} /> VER PRÁCTICAS Y EVENTOS
                            </button>
                        )}
                    </>
                ) : (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        {specialEvents.length > 0 && (
                            <>
                                <p style={{ fontSize: '11px', opacity: 0.5, letterSpacing: '1px', marginBottom: '15px', color: '#f1c40f' }}>PRÁCTICAS Y EVENTOS ESPECIALES</p>
                                <div className="grid-classes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                                    {specialEvents.map(cls => (
                                        <div key={cls.id} className="card flex justify-between align-center" onClick={() => {
                                            if (cls.date && cls.date !== selectedDate) {
                                                if (window.confirm(`Este evento está programado para el ${new Date(cls.date + 'T12:00:00').toLocaleDateString('es-UY')}. ¿Deseas cambiar a esa fecha?`)) {
                                                    setSelectedDate(cls.date);
                                                }
                                            }
                                            setSelectedClassId(cls.id);
                                        }} style={{ cursor: 'pointer', background: 'rgba(241, 196, 15, 0.05)', border: '1px solid rgba(241, 196, 15, 0.1)', padding: '15px' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '11px', color: '#f1c40f', fontWeight: 'bold' }}>{new Date(cls.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'long' })}</p>
                                                <h3 style={{ margin: '5px 0', fontSize: '1.2rem' }}>{cls.name}</h3>
                                            </div>
                                            <Calendar size={20} color="#f1c40f" opacity={0.5} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        <button 
                            className="btn btn-secondary" 
                            onClick={() => setShowPracticesList(false)}
                            style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '14px', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', background: 'rgba(255, 255, 255, 0.05)', transition: 'background-color 0.2s' }}
                        >
                            <ArrowLeft size={18} /> VOLVER A GRUPOS REGULARES
                        </button>
                    </div>
                )}
            </div>
        );
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) {
        return (
            <div className="flex flex-column align-center justify-center" style={{ height: '300px', opacity: 0.5 }}>
                <Loader2 className="spin" size={30} style={{ marginBottom: '15px' }} />
                <p>Cargando sesión...</p>
                <button className="btn btn-secondary" onClick={() => setSelectedClassId('')} style={{ marginTop: '10px' }}>Volver al selector</button>
            </div>
        );
    }

    // Obtener el nombre del día de la fecha seleccionada de forma robusta
    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const selectedDayName = daysEs[selectedDateObj.getDay()];
    
    const isAutomaticNoClass = selectedClass && !selectedClass.isPractice && selectedDayName.toLowerCase().trim() !== selectedClass.day.toLowerCase().trim();
    const hasSavedRecords = records.some(r => 
        r.date === selectedDate && 
        r.classId === selectedClassId && 
        r.studentId !== 'NO_CLASS' && 
        (r.present === true || Number(r.paymentAmount) > 0 || r.isGuest || r.isRecovery || r.isPL)
    );
    const isNoClassActive = (studentRecords['NO_CLASS'] || isAutomaticNoClass) && !hasSavedRecords && !forceOpen;

    const extraIdsArr = Object.keys(extraData);
    const visibleStudents = students.filter(s =>
        (s.enrolledClasses || []).includes(selectedClassId) ||
        (s.guestClasses || []).includes(selectedClassId) ||
        extraIdsArr.includes(s.id)
    );

    const finalVisibleStudents = showOnlyPending 
        ? visibleStudents.filter(s => {
            const rec = studentRecords[s.id];
            return rec && rec.present && Number(rec.paymentAmount) <= 0;
          })
        : visibleStudents;

    const searchResults = searchExtra.length > 1 ? students.filter(s =>
        s.name.toLowerCase().includes(searchExtra.toLowerCase()) &&
        !visibleStudents.find(vs => vs.id === s.id)
    ) : [];

    const monthPrefix = selectedDate.substring(0, 7);
    const monthlyPayments = records.filter(r =>
        r.date && r.date.startsWith(monthPrefix) &&
        (Number(r.paymentAmount) > 0)
    );

    const studentMonthlyStatus = {};
    students.forEach(s => {
        const payment = monthlyPayments.filter(p => p.studentId === s.id && (Number(p.paymentAmount) === Number(selectedClass.monthlyPrice) || Number(p.paymentAmount) === Number(selectedClass.monthly2xsPrice))).sort((a,b) => b.date.localeCompare(a.date))[0];
        if (payment) {
            studentMonthlyStatus[s.id] = {
                date: payment.date,
                plan: Number(payment.paymentAmount) === Number(selectedClass.monthlyPrice) ? '1xS' : '2xS',
                paymentMethod: payment.paymentMethod,
                receiptSent: payment.receiptSent
            };
        }
    });

    return (
        <div className="attendance-form">
            <header className="card attendance-header flex justify-between align-center" style={{ marginBottom: '20px', padding: '15px 20px', position: 'sticky', top: '70px', zIndex: 10, backgroundColor: 'rgba(52, 73, 94, 0.95)', backdropFilter: 'blur(10px)' }}>
                <div className="flex align-center gap-15">
                    <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleExit}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex align-center gap-10">
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedClass?.name}</h3>
                            <div className="flex align-center gap-5">
                                <button className="btn btn-secondary" style={{ padding: '2px', background: 'none', border: 'none' }} onClick={() => moveDate(-7)}>
                                    <ChevronLeft size={16} opacity={0.6}/>
                                </button>
                                <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} style={{ background: 'none', border: 'none', color: 'white', padding: 0, fontSize: '12px', opacity: 0.6, marginBottom: 0, width: '115px' }} />
                                <button className="btn btn-secondary" style={{ padding: '2px', background: 'none', border: 'none' }} onClick={() => moveDate(7)}>
                                    <ChevronRight size={16} opacity={0.6}/>
                                </button>
                            </div>
                        </div>
                        <button 
                            className="btn btn-secondary" 
                            style={{ 
                                padding: '8px 12px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '11px',
                                backgroundColor: studentRecords['NO_CLASS'] ? '#e74c3c' : 'rgba(255,255,255,0.05)',
                                color: studentRecords['NO_CLASS'] ? 'white' : 'white',
                                borderColor: studentRecords['NO_CLASS'] ? '#e74c3c' : 'rgba(255,255,255,0.2)'
                            }} 
                            onClick={toggleNoClass}
                        >
                            <CalendarOff size={14} />
                            {studentRecords['NO_CLASS'] ? 'SIN CLASE' : 'MARCAR SIN CLASE'}
                        </button>
                    </div>
                </div>
                <div className="flex align-center gap-15">
                    {(feedbackMsg || (hasUnsavedChanges && !isSaving)) && (
                        <div style={{ 
                            fontSize: '11px', 
                            color: feedbackMsg.includes('Error') ? '#e74c3c' : (hasUnsavedChanges ? '#f1c40f' : '#2ecc71'), 
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            {feedbackMsg || (
                                <>
                                    <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #f1c40f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                        {countdown}
                                    </span>
                                    Cambios pendientes...
                                </>
                            )}
                        </div>
                    )}
                    {hasUnsavedChanges && !isSaving && (
                        <button className="btn" onClick={handleSave} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '10px 20px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)' }}>
                            <Save size={18} /> GUARDAR
                        </button>
                    )}
                </div>
            </header>

            {pendingAction && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '30px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '15px' }}>¿Deseas guardar los cambios?</h3>
                        <p style={{ opacity: 0.7, marginBottom: '25px', fontSize: '14px' }}>Tienes cambios sin guardar en esta asistencia.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn" onClick={() => confirmAction(true)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '12px' }}>GUARDAR Y CONTINUAR</button>
                            <button className="btn" onClick={() => confirmAction(false)} style={{ backgroundColor: 'transparent', border: '1px solid #4a5568', padding: '12px' }}>CONTINUAR SIN GUARDAR</button>
                            <button className="btn btn-secondary" onClick={() => setPendingAction(null)} style={{ padding: '12px' }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            {isNoClassActive ? (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: isAutomaticNoClass ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)', border: isAutomaticNoClass ? '1px solid rgba(52, 152, 219, 0.2)' : '1px solid rgba(231, 76, 60, 0.2)' }}>
                    {isAutomaticNoClass ? <Search size={50} color="#3498db" style={{ marginBottom: '20px', opacity: 0.5 }} /> : <CalendarOff size={50} color="#e74c3c" style={{ marginBottom: '20px', opacity: 0.5 }} />}
                    <h2 style={{ margin: 0, color: isAutomaticNoClass ? '#3498db' : '#e74c3c' }}>
                        {isAutomaticNoClass ? `ESTA CLASE NO TOCA UN ${selectedDayName.toUpperCase()}` : 'ESTE DÍA NO HUBO CLASE'}
                    </h2>
                    <p style={{ opacity: 0.7, maxWidth: '400px', margin: '15px auto 0' }}>
                        {isAutomaticNoClass 
                            ? `Este grupo está programado para los días ${selectedClass.day}. Estás visualizando un ${selectedDayName}.`
                            : "Se ha marcado esta fecha como 'sin actividad'. No se computará alquiler ni asistencias para esta sesión."}
                    </p>
                    {isAutomaticNoClass && (
                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                            <p style={{ fontSize: '11px', opacity: 0.5, margin: 0 }}>
                                Usa las flechas o el calendario para buscar el {selectedClass.day} correspondiente.
                            </p>
                            <button 
                                className="btn btn-secondary" 
                                style={{ fontSize: '12px', padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.05)' }} 
                                onClick={() => setForceOpen(true)}
                            >
                                VER DE TODAS FORMAS
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
                    <div className="flex gap-15 align-center" style={{ marginBottom: searchResults.length > 0 ? '15px' : 0 }}>
                        <Search size={18} opacity={0.5} />
                        <input 
                            type="search" 
                            placeholder="Buscar alumno para Recuperar o Invitado..." 
                            value={searchExtra} 
                            onChange={(e) => setSearchExtra(e.target.value)}
                            style={{ background: 'none', border: 'none', color: 'white', flex: 1, marginBottom: 0 }}
                        />
                        {selectedClass.isPractice && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => setShowOnlyPending(!showOnlyPending)}
                                    style={{ 
                                        fontSize: '11px', padding: '8px 12px', 
                                        border: '1px solid',
                                        borderColor: showOnlyPending ? '#e74c3c' : 'rgba(255, 255, 255, 0.2)',
                                        color: showOnlyPending ? 'white' : 'rgba(255, 255, 255, 0.6)', 
                                        background: showOnlyPending ? '#e74c3c' : 'rgba(255, 255, 255, 0.05)',
                                        fontWeight: showOnlyPending ? 'bold' : 'normal',
                                        minWidth: '150px'
                                    }}
                                >
                                    <EyeOff size={14} style={{ marginRight: '5px' }} /> 
                                    {showOnlyPending ? 'FILTRO: PENDIENTES' : 'MOSTRAR SOLO PENDIENTES'}
                                </button>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handlePreloadAll}
                                    style={{ fontSize: '11px', padding: '8px 12px', border: '1px solid rgba(241, 196, 15, 0.3)', color: '#f1c40f', background: 'rgba(241, 196, 15, 0.05)' }}
                                >
                                    <Users size={14} style={{ marginRight: '5px' }} /> PRECARGAR LISTA
                                </button>
                            </div>
                        )}
                    </div>
                    {searchResults.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {searchResults.map(s => (
                                <div key={s.id} className="flex justify-between align-center mobile-search-item" style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', gap: '10px' }}>
                                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{s.name}</span>
                                    <div className="flex gap-5 flex-wrap justify-end">
                                        <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => addExtraStudent(s, 'recovery')}>RECUPERA</button>
                                        <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => addExtraStudent(s, 'guest')}>INVITADO</button>
                                        <button className="btn" style={{ fontSize: '10px', padding: '4px 8px', backgroundColor: '#9b59b6', color: 'white', border: 'none' }} title="Pase Libre - No genera deuda" onClick={() => addExtraStudent(s, 'pl')}>PL</button>
                                        <button className="btn" style={{ fontSize: '10px', padding: '4px 8px', backgroundColor: '#3498db', color: 'white', border: 'none' }} onClick={() => enrollStudent(s)}>ANOTAR</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="attendance-table" style={{ minWidth: '100%' }}>
                            <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <tr>
                                    <th style={{ padding: '15px', minWidth: '100px' }}>Alumno</th>
                                    <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>Asist.</th>
                                    <th>Pago y Recibo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalVisibleStudents.map(student => {
                                    const rec = studentRecords[student.id] || { present: false, paymentAmount: 0, paymentMethod: '', receiptSent: false };
                                    const studentStatus = emailStatus[student.id];
                                    const type = extraData[student.id];
                                    const activePlan = studentMonthlyStatus[student.id];
                                    
                                    const amountNum = Number(rec.paymentAmount);
                                    const isS = amountNum === Number(selectedClass.classPrice) && amountNum > 0;
                                    const is1xS = (amountNum === Number(selectedClass.monthlyPrice) && amountNum > 0) || (amountNum === 0 && activePlan?.plan === '1xS');
                                    const is2xS = (amountNum === Number(selectedClass.monthly2xsPrice) && amountNum > 0) || (amountNum === 0 && activePlan?.plan === '2xS');
                                    
                                    const activePlanMethod = (amountNum === 0 && activePlan) ? activePlan.paymentMethod : rec.paymentMethod;
                                    const pColor = activePlanMethod === 'transfer' ? '#3498db' : '#2ecc71';
                                    const pBg = activePlanMethod === 'transfer' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(46, 204, 113, 0.15)';
                                    
                                    const isReceiptSentPersistent = rec.receiptSent || (amountNum === 0 && activePlan?.receiptSent);
                                    const currentEmailStatus = studentStatus || (isReceiptSentPersistent ? 'done' : null);
                                    
                                    const isBirthday = student.birthDay && student.birthMonth && parseInt(student.birthDay) === parseInt(selectedDate.split('-')[2]) && parseInt(student.birthMonth) === parseInt(selectedDate.split('-')[1]);

                                    return (
                                        <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '12px 15px' }}>
                                                <div 
                                                    style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                                                    onClick={() => setViewHistory(student)}
                                                    title="Ver Historial"
                                                >
                                                    <span 
                                                        className="no-underline"
                                                        style={{ fontWeight: 600, fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }} 
                                                        spellCheck="false" autoCorrect="off" autoCapitalize="none"
                                                    >
                                                        {student.name}
                                                        {isBirthday && <Cake size={14} color="#f1c40f" title="¡Es su cumpleaños!" />}
                                                    </span>
                                                    {student.email && <span className="no-underline" style={{ fontSize: '10px', opacity: 0.4 }}>{student.email}</span>}
                                                    <div className="flex gap-5 mt-2">
                                                        {type === 'recovery' && !selectedClass.isPractice && <span style={{ fontSize: '9px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '2px 5px', borderRadius: '3px' }}>RECUPERA</span>}
                                                        {type === 'guest' && <span style={{ fontSize: '9px', background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '2px 5px', borderRadius: '3px' }}>INVITADO</span>}
                                                        {type === 'pl' && !selectedClass.isPractice && <span style={{ fontSize: '9px', background: 'rgba(155, 89, 182, 0.2)', color: '#9b59b6', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>PL</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button onClick={() => togglePresence(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: rec.present ? '#2ecc71' : '#bdc3c7' }}>
                                                    {rec.present ? <CircleCheck size={28} /> : <Circle size={28} opacity={0.3} />}
                                                </button>
                                            </td>
                                            <td style={{ padding: '8px 5px' }}>
                                                 <div className="payment-controls" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                     <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                         <input type="number" value={rec.paymentAmount} onChange={(e) => handleValueChange(student.id, 'paymentAmount', e.target.value)} style={{ marginBottom: 0, padding: '8px', fontSize: '15px', textAlign: 'center', flex: '1 1 60px', minWidth: '60px', fontWeight: 'bold' }} />
                                                         
                                                         <button 
                                                             disabled={(amountNum <= 0 && !activePlan) || !student.email || currentEmailStatus === 'sending'}
                                                             onClick={() => handleSendReceipt(student, amountNum > 0 ? rec : activePlan ? { paymentAmount: activePlan.plan === '1xS' ? selectedClass.monthlyPrice : selectedClass.monthly2xsPrice } : rec)}
                                                             className="btn"
                                                             style={{ 
                                                                 padding: '8px', backgroundColor: currentEmailStatus === 'sent' || currentEmailStatus === 'done' ? '#2ecc71' : '#3498db', 
                                                                 border: 'none', opacity: ((amountNum > 0 || activePlan) && student.email) ? 1 : 0.3,
                                                                 transition: 'all 0.3s ease',
                                                                 borderRadius: '6px'
                                                             }}
                                                             title="Enviar Recibo por Mail"
                                                         >
                                                             {currentEmailStatus === 'sending' ? <Loader2 size={16} className="spin" /> : 
                                                             (currentEmailStatus === 'sent' || currentEmailStatus === 'done') ? <CheckCircle size={16} /> : 
                                                             <Mail size={16} />}
                                                         </button>
 
                                                         <button 
                                                             disabled={(amountNum <= 0 && !activePlan)}
                                                             onClick={() => handleSendWA(student, 'receipt', { 
                                                                 amount: amountNum > 0 ? amountNum : activePlan ? (activePlan.plan === '1xS' ? selectedClass.monthlyPrice : selectedClass.monthly2xsPrice) : 0,
                                                                 date: selectedDate,
                                                                 classId: selectedClassId 
                                                             })}
                                                             className="btn"
                                                             style={{ 
                                                                 padding: '8px', backgroundColor: rec.waReceiptSent ? '#2ecc71' : '#3498db', 
                                                                 border: 'none', opacity: (amountNum > 0 || activePlan) ? 1 : 0.3,
                                                                 transition: 'all 0.3s ease',
                                                                 borderRadius: '6px'
                                                             }}
                                                             title="Enviar Recibo por WhatsApp"
                                                         >
                                                             <MessageCircle size={16} />
                                                         </button>
 
                                                         <div style={{ display: 'flex', gap: '3px', flex: '1 1 auto' }}>
                                                             <button className="btn btn-secondary" onClick={() => handleValueChange(student.id, 'paymentMethod', 'cash')} style={{ padding: '8px 4px', flex: 1, fontSize: '11px', justifyContent: 'center', fontWeight: 'bold', minWidth: '35px', ...((rec.paymentMethod === 'cash' || (amountNum === 0 && activePlan?.paymentMethod === 'cash')) ? { backgroundColor: '#2ecc71', color: 'white', borderColor: '#2ecc71' } : {}) }}>Efe</button>
                                                             <button className="btn btn-secondary" onClick={() => handleValueChange(student.id, 'paymentMethod', 'transfer')} style={{ padding: '8px 4px', flex: 1, fontSize: '11px', justifyContent: 'center', fontWeight: 'bold', minWidth: '35px', ...((rec.paymentMethod === 'transfer' || (amountNum === 0 && activePlan?.paymentMethod === 'transfer')) ? { backgroundColor: '#3498db', color: 'white', borderColor: '#3498db' } : {}) }}>Trf</button>
                                                         </div>
                                                     </div>
                                                     {!selectedClass.isPractice && (
                                                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                                                             <button className="btn btn-secondary" style={{ padding: '6px 2px', fontSize: '9px', justifyContent: 'center', ...(isS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.classPrice)}>S: ${selectedClass.classPrice}</button>
                                                             <button className="btn btn-secondary" style={{ padding: '6px 2px', fontSize: '9px', justifyContent: 'center', ...(is1xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthlyPrice)}>1xS</button>
                                                             <button className="btn btn-secondary" style={{ padding: '6px 2px', fontSize: '9px', justifyContent: 'center', ...(is2xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthly2xsPrice)}>2xS</button>
                                                             <button className="btn btn-secondary" style={{ padding: '6px 2px', fontSize: '9px', color: '#9b59b6', borderColor: extraData[student.id] === 'pl' ? '#9b59b6' : '', backgroundColor: extraData[student.id] === 'pl' ? 'rgba(155, 89, 182, 0.1)' : '', justifyContent: 'center' }} onClick={() => {
                                                                 handleValueChange(student.id, 'paymentAmount', selectedClass.plPrice || 249);
                                                                 handleValueChange(student.id, 'paymentMethod', 'transfer');
                                                                 setExtraData(prev => ({ ...prev, [student.id]: 'pl' }));
                                                             }}>PL: ${selectedClass.plPrice || 249}</button>
                                                         </div>
                                                     )}
                                                     {amountNum === 0 && activePlan && (
                                                         <div style={{ fontSize: '9px', color: '#2ecc71', textAlign: 'center', marginTop: '-2px', fontWeight: '500' }}>
                                                             Abonado {new Date(activePlan.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                          </div>
                                                      )}
                                                      {selectedClass.isPractice && rec.present && (
                                                         <div style={{ 
                                                             display: 'flex', 
                                                             flexDirection: 'column',
                                                             alignItems: 'center', 
                                                             justifyContent: 'center',
                                                             gap: '6px', 
                                                             marginTop: '5px',
                                                             padding: '8px 5px',
                                                             backgroundColor: 'rgba(241, 196, 15, 0.08)',
                                                             borderRadius: '8px',
                                                             border: '1px solid rgba(241, 196, 15, 0.2)',
                                                             animation: 'fadeIn 0.3s ease'
                                                         }}>
                                                             <span style={{ fontSize: '10px', color: '#f1c40f', fontWeight: 'bold', opacity: 0.8 }}>¿PAGÓ?</span>
                                                             <div style={{ display: 'flex', gap: '5px', width: '100%', justifyContent: 'center' }}>
                                                                 {(() => {
                                                                     const isInvClicked = extraData[student.id] === 'guest';
                                                                     const isSiClicked = amountNum > 0;
                                                                     const isNoClicked = amountNum === 0 && !isInvClicked && (answeredPracticePayment.has(student.id) || (rec.present && !isInvClicked && amountNum === 0 && false)); // El false es para no marcar NO por defecto si no interactuó
                                                                     
                                                                     // Definir si hay alguno seleccionado para saber si grisar el resto
                                                                     const somethingSelected = isSiClicked || isNoClicked || isInvClicked;

                                                                     const getBtnStyle = (active, color, activeColor = 'white') => ({
                                                                         padding: '6px', 
                                                                         fontSize: '10px', 
                                                                         flex: '1', 
                                                                         backgroundColor: active ? color : (somethingSelected ? 'rgba(255,255,255,0.1)' : color),
                                                                         color: active ? activeColor : (somethingSelected ? 'rgba(255,255,255,0.5)' : activeColor),
                                                                         border: active ? 'none' : (somethingSelected ? '1px solid rgba(255,255,255,0.1)' : 'none'),
                                                                         fontWeight: 'bold', 
                                                                         borderRadius: '4px',
                                                                         opacity: somethingSelected && !active ? 0.65 : 1,
                                                                         transition: 'all 0.2s'
                                                                     });

                                                                     return (
                                                                         <>
                                                                             <button 
                                                                                 className="btn" 
                                                                                 onClick={() => {
                                                                                     setHasUnsavedChanges(true);
                                                                                     handleValueChange(student.id, 'paymentAmount', selectedClass.classPrice || 0);
                                                                                     handleValueChange(student.id, 'paymentMethod', 'cash');
                                                                                     if (extraData[student.id] === 'guest') {
                                                                                         setExtraData(prev => ({ ...prev, [student.id]: 'event' }));
                                                                                     }
                                                                                     setAnsweredPracticePayment(prev => new Set(prev).add(student.id));
                                                                                 }}
                                                                                 style={getBtnStyle(isSiClicked, '#2ecc71')}
                                                                             >SÍ</button>
                                                                             <button 
                                                                                 className="btn"
                                                                                 onClick={() => {
                                                                                     setHasUnsavedChanges(true);
                                                                                     handleValueChange(student.id, 'paymentAmount', 0);
                                                                                     handleValueChange(student.id, 'paymentMethod', '');
                                                                                     if (extraData[student.id] === 'guest') {
                                                                                         setExtraData(prev => ({ ...prev, [student.id]: 'event' }));
                                                                                     }
                                                                                     setAnsweredPracticePayment(prev => {
                                                                                         const next = new Set(prev);
                                                                                         next.add(student.id);
                                                                                         return next;
                                                                                     });
                                                                                 }}
                                                                                 style={getBtnStyle(isNoClicked, '#e74c3c')}
                                                                             >NO</button>
                                                                             <button 
                                                                                 className="btn"
                                                                                 onClick={() => {
                                                                                     setHasUnsavedChanges(true);
                                                                                     handleValueChange(student.id, 'paymentAmount', 0);
                                                                                     handleValueChange(student.id, 'paymentMethod', '');
                                                                                     setExtraData(prev => ({ ...prev, [student.id]: 'guest' }));
                                                                                     setAnsweredPracticePayment(prev => {
                                                                                         const next = new Set(prev);
                                                                                         next.add(student.id);
                                                                                         return next;
                                                                                     });
                                                                                 }}
                                                                                 style={getBtnStyle(isInvClicked, '#f1c40f', '#1a202c')}
                                                                             >INV</button>
                                                                         </>
                                                                     );
                                                                 })()}
                                                             </div>
                                                         </div>
                                                      )}
                                                     {type && (
                                                         <button onClick={() => removeExtra(student.id)} style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.2)', color: '#e74c3c', fontSize: '9px', padding: '4px', borderRadius: '4px' }}>Quitar Alumno</button>
                                                     )}
                                                 </div>
                                             </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                </>
            )}
            {/* Modal de Historial */}
            {viewHistory && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <div className="flex justify-between align-center" style={{ marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{viewHistory.name}</h3>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '5px', opacity: 0.6, fontSize: '12px' }}>
                                    {viewHistory.phone && (
                                        <a 
                                            href={`https://wa.me/${viewHistory.phone.replace(/\D/g, '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            style={{ color: '#2ecc71', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}
                                            title="Enviar WhatsApp"
                                        >
                                            <Phone size={12} /> {viewHistory.phone}
                                        </a>
                                    )}
                                    {viewHistory.email && (
                                        <a 
                                            href={`mailto:${viewHistory.email}`} 
                                            style={{ color: '#3498db', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}
                                            title="Enviar Correo"
                                        >
                                            <Mail size={12} /> {viewHistory.email}
                                        </a>
                                    )}
                                </div>
                                
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                                    {(() => {
                                        const currentPrefix = new Date().toISOString().substring(0, 7);
                                        const isRemSent = viewHistory.waReminderSentAt && viewHistory.waReminderSentAt.startsWith(currentPrefix);
                                        return (
                                            <button 
                                                onClick={() => handleSendWA(viewHistory, 'debt')}
                                                className="btn" 
                                                style={{ fontSize: '10px', padding: '6px 12px', backgroundColor: isRemSent ? '#2ecc71' : '#e74c3c', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                                            >
                                                <MessageCircle size={12} /> {isRemSent ? 'RECORDATORIO ENVIADO' : 'ENVIAR RECORDATORIO (WA)'}
                                            </button>
                                        );
                                    })()}
                                </div>

                                <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '10px', opacity: 0.4, letterSpacing: '1px' }}>GESTIÓN DE GRUPOS</p>
                                    <div className="flex flex-column gap-5">
                                        {[...(viewHistory.enrolledClasses || []), ...(viewHistory.guestClasses || [])].map(cid => {
                                            const cls = classes.find(c => c.id === cid);
                                            const isGuest = (viewHistory.guestClasses || []).includes(cid);
                                            return (
                                                <div key={cid} className="flex justify-between align-center" style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                                    <div className="flex align-center gap-5">
                                                        <span style={{ fontSize: '12px' }}>{cls ? cls.name : 'Clase eliminada'}</span>
                                                        {isGuest && <span style={{ fontSize: '8px', background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '1px 4px', borderRadius: '3px' }}>INVITADO</span>}
                                                    </div>
                                                  <button 
                                                      onClick={() => {
                                                          setConfirmModal({
                                                              title: isGuest ? 'Quitar Invitado' : 'Dar de Baja',
                                                              message: isGuest 
                                                                ? `¿Deseas quitar a este alumno de la lista de invitados de ${cls?.name || cid}?`
                                                                : `¿Deseas quitar a este alumno del grupo ${cls?.name || cid}? (Esto es una baja permanente del grupo)`,
                                                              onConfirm: () => {
                                                                  const updates = {};
                                                                  if (isGuest) {
                                                                      updates.guestClasses = viewHistory.guestClasses.filter(id => id !== cid);
                                                                  } else {
                                                                      updates.enrolledClasses = viewHistory.enrolledClasses.filter(id => id !== cid);
                                                                  }
                                                                  updateStudent(viewHistory.id, updates);
                                                                  setViewHistory({ ...viewHistory, ...updates });
                                                                  
                                                                  // Si es la clase actual, quitar también de la lista de hoy para que no quede como 'recupera'
                                                                  if (cid === selectedClassId) {
                                                                      removeExtra(viewHistory.id, true);
                                                                  }
                                                                  setConfirmModal(null);
                                                              }
                                                          });
                                                      }} 
                                                      style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                                  >QUITAR</button>
                                                </div>
                                            );
                                        })}
                                        <select 
                                            onChange={(e) => {
                                                const newCid = e.target.value;
                                                if (newCid) {
                                                    const newEnrolled = [...(viewHistory.enrolledClasses || []), newCid];
                                                    updateStudent(viewHistory.id, { enrolledClasses: newEnrolled });
                                                    setViewHistory({ ...viewHistory, enrolledClasses: newEnrolled });
                                                }
                                            }} 
                                            style={{ marginTop: '8px', fontSize: '11px', height: '32px', marginBottom: 0, padding: '0 10px' }}
                                            value=""
                                        >
                                            <option value="">+ Cambiar / Agregar a grupo...</option>
                                            {classes.filter(c => !(viewHistory.enrolledClasses || []).includes(c.id)).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p style={{ margin: '20px 0 10px 0', fontSize: '11px', opacity: 0.4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Historial de Asistencias (Mes Actual)</p>
                            </div>
                            <button onClick={() => setViewHistory(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%', alignSelf: 'flex-start' }}>
                                <XCircle size={22} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(() => {
                                const currentMonthPrefix = new Date().toISOString().substring(0, 7);
                                const studentMonthRecords = records.filter(r => r.studentId === viewHistory.id && r.date.startsWith(currentMonthPrefix) && (r.present || (parseFloat(r.paymentAmount) > 0))).sort((a,b) => b.date.localeCompare(a.date));
                                
                                if (studentMonthRecords.length === 0) {
                                    return <p style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>No se registraron asistencias este mes.</p>;
                                }

                                return studentMonthRecords.map(r => {
                                    const cls = classes.find(c => c.id === r.classId);
                                    let typeLabel = "REGULAR";
                                    let typeColor = "#3498db";
                                    if (r.isGuest) { typeLabel = "INVITADO"; typeColor = "#f1c40f"; }
                                    else if (r.isRecovery) { typeLabel = "RECUPERA"; typeColor = "#e74c3c"; }
                                    else if (r.isPL) { typeLabel = "PASE LIBRE"; typeColor = "#9b59b6"; }

                                    return (
                                        <div key={r.date + r.classId} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px 15px', borderRadius: '8px', borderLeft: `4px solid ${typeColor}` }}>
                                            <div className="flex justify-between align-center">
                                                <span style={{ fontSize: '14px', fontWeight: '600' }}>{new Date(r.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}</span>
                                                <span style={{ fontSize: '10px', color: typeColor, fontWeight: 'bold', padding: '2px 6px', backgroundColor: `${typeColor}22`, borderRadius: '4px' }}>
                                                    {r.present ? typeLabel : "PAGO SIN ASIST."}
                                                </span>
                                            </div>
                                            <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.7 }}>{cls ? cls.name : 'Clase eliminada'}</p>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
                                                {Number(r.paymentAmount) > 0 && (
                                                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '6px', border: '1px solid rgba(46, 204, 113, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div className="flex align-center gap-5">
                                                            <span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: '700' }}>PAGÓ: ${r.paymentAmount}</span>
                                                        </div>
                                                        <div className="flex align-center gap-10">
                                                            <span style={{ fontSize: '10px', opacity: 0.5, fontWeight: '500', textTransform: 'uppercase' }}>{r.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}</span>
                                                            <button 
                                                                onClick={() => handleSendWA(viewHistory, 'receipt', { amount: r.paymentAmount, date: r.date, classId: r.classId })}
                                                                style={{ background: r.waReceiptSent ? '#2ecc71' : '#e74c3c', border: 'none', color: 'white', cursor: 'pointer', padding: '6px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 'bold' }}
                                                                title="Enviar Recibo WA"
                                                            >
                                                                <MessageCircle size={12} /> {r.waReceiptSent ? 'RECIBO ENVIADO' : 'ENVIAR RECIBO'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {r.receiptSent && (
                                                    <div style={{ fontSize: '10px', color: '#2ecc71', opacity: 0.8, display: 'flex', alignCenter: 'center', gap: '5px', marginLeft: '5px' }}>
                                                        <CheckCircle size={10} /> RECIBO ENVIADO (Mail) {r.receiptSentAt ? `el ${new Date(r.receiptSentAt).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        
                        <button onClick={() => setViewHistory(null)} className="btn btn-secondary" style={{ width: '100%', marginTop: '30px', justifyContent: 'center' }}>CERRAR</button>
                    </div>
                </div>
            )}
            
            {/* Modal de Confirmación Genérico */}
            {confirmModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '30px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '15px' }}>{confirmModal.title}</h3>
                        <p style={{ opacity: 0.7, marginBottom: '25px', fontSize: '14px' }}>{confirmModal.message}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn" onClick={confirmModal.onConfirm} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '12px' }}>CONFIRMAR</button>
                            <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} style={{ padding: '12px' }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
