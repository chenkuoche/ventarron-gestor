import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import {
    CircleCheck,
    Wallet,
    CreditCard,
    Save,
    ArrowLeft,
    ChevronRight,
    Circle,
    Search,
    UserMinus,
    Mail,
    Loader2,
    CheckCircle
} from 'lucide-react';

const Attendance = () => {
    const { students, classes, records, saveAttendanceAndPayment, updateStudent, hasUnsavedChanges, setHasUnsavedChanges, selectedClassId, setSelectedClassId, sendEmail, markReceiptSent } = useAppContext();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [studentRecords, setStudentRecords] = useState({});
    const [searchExtra, setSearchExtra] = useState('');
    const [extraData, setExtraData] = useState({}); // { studentId: 'recovery' | 'guest' }
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [idsToDelete, setIdsToDelete] = useState([]); // Alumnos quitados de la lista (para borrar de Firestore)
    const [emailStatus, setEmailStatus] = useState({}); // { studentId: 'sending' | 'sent' | 'error' }
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
                        present: record.present,
                        paymentAmount: record.paymentAmount,
                        paymentMethod: record.paymentMethod,
                        receiptSent: record.receiptSent
                    };
                    if (!(s.enrolledClasses || []).includes(selectedClassId)) {
                        existingExtra[s.id] = record.isGuest ? 'guest' : 'recovery';
                    }
                } else if ((s.enrolledClasses || []).includes(selectedClassId)) {
                    initial[s.id] = {
                        present: false,
                        paymentAmount: 0,
                        paymentMethod: '',
                        receiptSent: false
                    };
                } else if ((s.guestClasses || []).includes(selectedClassId)) {
                    initial[s.id] = {
                        present: false,
                        paymentAmount: 0,
                        paymentMethod: '',
                        receiptSent: false
                    };
                    existingExtra[s.id] = 'guest';
                }
            });

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
        lastRemoteSync.current = null;
    }, [selectedClassId, selectedDate]);

    const handleSave = async () => {
        if (!selectedClassId || isSaving) return;
        setIsSaving(true);
        setFeedbackMsg('Enviando...');
        
        const finalRecords = {};
        Object.keys(studentRecords).forEach(id => {
            finalRecords[id] = {
                ...studentRecords[id],
                isGuest: extraData[id] === 'guest'
            };
        });

        try {
            saveAttendanceAndPayment(selectedDate, selectedClassId, finalRecords, idsToDelete);
            setTimeout(() => {
                setHasUnsavedChanges(false);
                setIdsToDelete([]);
                setIsSaving(false);
                setFeedbackMsg('¡GUARDADO! ✅');
                setTimeout(() => setFeedbackMsg(''), 3000);
            }, 800);
        } catch (error) {
            console.error(error);
            setFeedbackMsg('❌ Error al guardar');
            setIsSaving(false);
            setTimeout(() => setFeedbackMsg(''), 5000);
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

    const handleExit = () => {
        if (hasUnsavedChanges) setShowExitConfirm(true);
        else setSelectedClassId('');
    };

    const confirmExit = (shouldSave) => {
        if (shouldSave) handleSave();
        setHasUnsavedChanges(false);
        setShowExitConfirm(false);
        setSelectedClassId('');
    };

    const togglePresence = (studentId) => {
        setHasUnsavedChanges(true);
        setStudentRecords(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], present: !prev[studentId].present }
        }));
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
        setStudentRecords(prev => ({
            ...prev,
            [student.id]: { present: true, paymentAmount: 0, paymentMethod: '', receiptSent: false }
        }));
        setExtraData(prev => ({ ...prev, [student.id]: type }));
        setSearchExtra('');
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

    const removeExtra = (id) => {
        setHasUnsavedChanges(true);
        const newStudentRecords = { ...studentRecords };
        delete newStudentRecords[id];
        setStudentRecords(newStudentRecords);
        setIdsToDelete(prev => [...new Set([...prev, id])]);
        const newExtraData = { ...extraData };
        delete newExtraData[id];
        setExtraData(newExtraData);
    };

    if (!selectedClassId) {
        return (
            <div className="attendance-select">
                <h3 style={{ marginBottom: '30px' }}>Seleccione una clase para tomar lista</h3>
                <div className="grid-classes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    {classes.map(cls => (
                        <div key={cls.id} className="card flex justify-between align-center" onClick={() => setSelectedClassId(cls.id)} style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '12px', opacity: 0.5, textTransform: 'uppercase' }}>{cls.day}</p>
                                <h3 style={{ margin: '5px 0' }}>{cls.name}</h3>
                                <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>{cls.time} - {cls.endTime}</p>
                            </div>
                            <ChevronRight size={20} opacity={0.3} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return null;

    const extraIdsArr = Object.keys(extraData);
    const visibleStudents = students.filter(s =>
        (s.enrolledClasses || []).includes(selectedClassId) ||
        (s.guestClasses || []).includes(selectedClassId) ||
        extraIdsArr.includes(s.id)
    );

    const searchResults = searchExtra.length > 1 ? students.filter(s =>
        s.name.toLowerCase().includes(searchExtra.toLowerCase()) &&
        !visibleStudents.find(vs => vs.id === s.id)
    ) : [];

    const monthPrefix = selectedDate.substring(0, 7);
    const monthlyPayments = records.filter(r =>
        r.date.startsWith(monthPrefix) &&
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
            <header className="card flex justify-between align-center" style={{ marginBottom: '20px', padding: '15px 20px', position: 'sticky', top: '70px', zIndex: 10, backgroundColor: 'rgba(52, 73, 94, 0.95)', backdropFilter: 'blur(10px)' }}>
                <div className="flex align-center gap-15">
                    <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleExit}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedClass?.name}</h3>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ background: 'none', border: 'none', color: 'white', padding: 0, fontSize: '12px', opacity: 0.6, marginBottom: 0 }} />
                    </div>
                </div>
                <div className="flex align-center gap-15">
                    {feedbackMsg && <div style={{ fontSize: '11px', color: feedbackMsg.includes('Error') ? '#e74c3c' : '#2ecc71', fontWeight: 'bold' }}>{feedbackMsg}</div>}
                    {hasUnsavedChanges && !isSaving && (
                        <button className="btn" onClick={handleSave} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '10px 20px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)' }}>
                            <Save size={18} /> GUARDAR
                        </button>
                    )}
                </div>
            </header>

            {showExitConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '30px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '15px' }}>¿Deseas guardar los cambios?</h3>
                        <p style={{ opacity: 0.7, marginBottom: '25px', fontSize: '14px' }}>Tienes cambios sin guardar en esta asistencia.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn" onClick={() => confirmExit(true)} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '12px' }}>GUARDAR Y SALIR</button>
                            <button className="btn" onClick={() => confirmExit(false)} style={{ backgroundColor: 'transparent', border: '1px solid #4a5568', padding: '12px' }}>SALIR SIN GUARDAR</button>
                            <button className="btn btn-secondary" onClick={() => setShowExitConfirm(false)} style={{ padding: '12px' }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <div className="flex gap-15 align-center" style={{ marginBottom: searchResults.length > 0 ? '15px' : 0 }}>
                    <Search size={18} opacity={0.5} />
                    <input 
                        type="search" 
                        placeholder="Buscar alumno para Recuperar o Invitado..." 
                        value={searchExtra} 
                        onChange={(e) => setSearchExtra(e.target.value)}
                        style={{ background: 'none', border: 'none', color: 'white', flex: 1, marginBottom: 0 }}
                    />
                </div>
                {searchResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {searchResults.map(s => (
                            <div key={s.id} className="flex justify-between align-center" style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                                <span style={{ fontWeight: 500 }}>{s.name}</span>
                                <div className="flex gap-10">
                                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => addExtraStudent(s, 'recovery')}>RECUPERA</button>
                                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => addExtraStudent(s, 'guest')}>INVITADO</button>
                                    <button className="btn" style={{ fontSize: '11px', padding: '5px 10px', backgroundColor: '#3498db', color: 'white', border: 'none' }} onClick={() => enrollStudent(s)}>ANOTAR</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '100%' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <tr>
                                <th style={{ padding: '15px', minWidth: '100px' }}>Alumno</th>
                                <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>Asist.</th>
                                <th>Pago y Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleStudents.map(student => {
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

                                return (
                                    <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 15px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{student.name}</span>
                                                {student.email && <span style={{ fontSize: '10px', opacity: 0.4 }}>{student.email}</span>}
                                                <div className="flex gap-5 mt-2">
                                                    {type === 'recovery' && <span style={{ fontSize: '9px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '2px 5px', borderRadius: '3px' }}>RECUPERA</span>}
                                                    {type === 'guest' && <span style={{ fontSize: '9px', background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '2px 5px', borderRadius: '3px' }}>INVITADO</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button onClick={() => togglePresence(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: rec.present ? '#2ecc71' : '#bdc3c7' }}>
                                                {rec.present ? <CircleCheck size={28} /> : <Circle size={28} opacity={0.3} />}
                                            </button>
                                        </td>
                                        <td style={{ padding: '10px 5px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input type="number" value={rec.paymentAmount} onChange={(e) => handleValueChange(student.id, 'paymentAmount', e.target.value)} style={{ marginBottom: 0, padding: '10px', fontSize: '16px', textAlign: 'center', flex: 1, minWidth: '70px', fontWeight: 'bold' }} />
                                                    
                                                    <button 
                                                        disabled={(amountNum <= 0 && !activePlan) || !student.email || currentEmailStatus === 'sending'}
                                                        onClick={() => handleSendReceipt(student, amountNum > 0 ? rec : activePlan ? { paymentAmount: activePlan.plan === '1xS' ? selectedClass.monthlyPrice : selectedClass.monthly2xsPrice } : rec)}
                                                        className="btn"
                                                        style={{ 
                                                            padding: '10px', backgroundColor: currentEmailStatus === 'sent' || currentEmailStatus === 'done' ? '#2ecc71' : '#3498db', 
                                                            border: 'none', opacity: ((amountNum > 0 || activePlan) && student.email) ? 1 : 0.3,
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    >
                                                        {currentEmailStatus === 'sending' ? <Loader2 size={18} className="spin" /> : 
                                                         (currentEmailStatus === 'sent' || currentEmailStatus === 'done') ? <CheckCircle size={18} /> : 
                                                         <Mail size={18} />}
                                                    </button>

                                                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                                        <button className="btn btn-secondary" onClick={() => handleValueChange(student.id, 'paymentMethod', 'cash')} style={{ padding: '10px 4px', flex: 1, fontSize: '12px', justifyContent: 'center', fontWeight: 'bold', ...((rec.paymentMethod === 'cash' || (amountNum === 0 && activePlan?.paymentMethod === 'cash')) ? { backgroundColor: '#2ecc71', color: 'white', borderColor: '#2ecc71' } : {}) }}>Efe</button>
                                                        <button className="btn btn-secondary" onClick={() => handleValueChange(student.id, 'paymentMethod', 'transfer')} style={{ padding: '10px 4px', flex: 1, fontSize: '12px', justifyContent: 'center', fontWeight: 'bold', ...((rec.paymentMethod === 'transfer' || (amountNum === 0 && activePlan?.paymentMethod === 'transfer')) ? { backgroundColor: '#3498db', color: 'white', borderColor: '#3498db' } : {}) }}>Trf</button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '8px 2px', fontSize: '10px', justifyContent: 'center', ...(isS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.classPrice)}>S: ${selectedClass.classPrice}</button>
                                                    <button className="btn btn-secondary" style={{ padding: '8px 2px', fontSize: '10px', justifyContent: 'center', ...(is1xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthlyPrice)}>1xS</button>
                                                    <button className="btn btn-secondary" style={{ padding: '8px 2px', fontSize: '10px', justifyContent: 'center', ...(is2xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg } : {}) }} onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthly2xsPrice)}>2xS</button>
                                                </div>
                                                {amountNum === 0 && activePlan && (
                                                    <div style={{ fontSize: '10px', color: '#2ecc71', textAlign: 'center', marginTop: '-2px', fontWeight: '500' }}>
                                                        Mensualidad abonada el {new Date(activePlan.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                    </div>
                                                )}
                                                {type && (
                                                    <button onClick={() => removeExtra(student.id)} style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.2)', color: '#e74c3c', fontSize: '10px', padding: '5px', borderRadius: '4px' }}>Quitar</button>
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
        </div>
    );
};

export default Attendance;
