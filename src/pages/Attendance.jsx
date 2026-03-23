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
    UserMinus
} from 'lucide-react';

const Attendance = () => {
    const { students, classes, records, saveAttendanceAndPayment, updateStudent } = useAppContext();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [studentRecords, setStudentRecords] = useState({});
    const [searchExtra, setSearchExtra] = useState('');
    const [extraData, setExtraData] = useState({}); // { studentId: 'recovery' | 'guest' }
    const loadedRef = React.useRef({ classId: '', date: '' });

    useEffect(() => {
        if (selectedClassId && selectedDate) {
            if (loadedRef.current.classId === selectedClassId && loadedRef.current.date === selectedDate) {
                return;
            }
            const existing = records.filter(r => r.date === selectedDate && r.classId === selectedClassId);
            const initial = {};
            const existingExtra = {};

            students.forEach(s => {
                const record = existing.find(r => r.studentId === s.id);
                if (record) {
                    initial[s.id] = {
                        present: record.present,
                        paymentAmount: record.paymentAmount,
                        paymentMethod: record.paymentMethod
                    };
                    if (!(s.enrolledClasses || []).includes(selectedClassId)) {
                        existingExtra[s.id] = record.isGuest ? 'guest' : 'recovery';
                    }
                } else if ((s.enrolledClasses || []).includes(selectedClassId)) {
                    initial[s.id] = {
                        present: false,
                        paymentAmount: 0,
                        paymentMethod: ''
                    };
                }
            });
            setStudentRecords(initial);
            setExtraData(existingExtra);
            loadedRef.current = { classId: selectedClassId, date: selectedDate };
        }
    }, [selectedClassId, selectedDate, records, students]);

    useEffect(() => {
        if (!selectedClassId || Object.keys(studentRecords).length === 0) return;
        if (loadedRef.current.classId !== selectedClassId || loadedRef.current.date !== selectedDate) return;

        const finalRecords = {};
        Object.keys(studentRecords).forEach(id => {
            finalRecords[id] = {
                ...studentRecords[id],
                isGuest: extraData[id] === 'guest'
            };
        });
        saveAttendanceAndPayment(selectedDate, selectedClassId, finalRecords);
    }, [studentRecords, extraData, selectedClassId, selectedDate, saveAttendanceAndPayment]);

    const togglePresence = (studentId) => {
        setStudentRecords(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                present: !prev[studentId].present
            }
        }));
    };

    const handleValueChange = (studentId, field, value) => {
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
                [studentId]: {
                    ...current,
                    ...updates
                }
            };
        });
    };

    // Manual save removed in favor of auto-save

    const addExtraStudent = (student, type) => {
        setStudentRecords(prev => ({
            ...prev,
            [student.id]: { present: true, paymentAmount: 0, paymentMethod: '' }
        }));
        setExtraData(prev => ({ ...prev, [student.id]: type }));
        setSearchExtra('');
    };

    const enrollStudent = (student) => {
        const newEnrolled = [...(student.enrolledClasses || []), selectedClassId];
        updateStudent(student.id, { enrolledClasses: newEnrolled });
        setStudentRecords(prev => ({
            ...prev,
            [student.id]: { present: true, paymentAmount: 0, paymentMethod: '' }
        }));
        setSearchExtra('');
    };

    const removeExtra = (id) => {
        const newStudentRecords = { ...studentRecords };
        delete newStudentRecords[id];
        setStudentRecords(newStudentRecords);

        const newExtraData = { ...extraData };
        delete newExtraData[id];
        setExtraData(newExtraData);
    };

    if (!selectedClassId) {
        return (
            <div className="attendance-select">
                <h3 style={{ marginBottom: '30px' }}>Seleccione una clase para tomar lista</h3>
                <div className="grid-classes" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px'
                }}>
                    {classes.map(cls => (
                        <div
                            key={cls.id}
                            className="card flex justify-between align-center"
                            onClick={() => setSelectedClassId(cls.id)}
                            style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                        >
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
    const extraIdsArr = Object.keys(extraData);
    const visibleStudents = students.filter(s =>
        (s.enrolledClasses || []).includes(selectedClassId) ||
        extraIdsArr.includes(s.id)
    );

    const searchResults = searchExtra.length > 1 ? students.filter(s =>
        s.name.toLowerCase().includes(searchExtra.toLowerCase()) &&
        !visibleStudents.find(vs => vs.id === s.id)
    ) : [];

    const monthPrefix = selectedDate.substring(0, 7);
    const monthlyPayments = records.filter(r =>
        r.date.startsWith(monthPrefix) &&
        (Number(r.paymentAmount) === Number(selectedClass?.monthlyPrice) || Number(r.paymentAmount) === Number(selectedClass?.monthly2xsPrice))
    );

    const studentMonthlyStatus = {};
    students.forEach(s => {
        const payment = monthlyPayments.filter(p => p.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date))[0];
        if (payment) {
            studentMonthlyStatus[s.id] = {
                date: payment.date,
                plan: Number(payment.paymentAmount) === Number(selectedClass.monthlyPrice) ? '1xS' : '2xS',
                paymentMethod: payment.paymentMethod
            };
        }
    });

    return (
        <div className="attendance-form">
            <header className="card flex justify-between align-center" style={{ marginBottom: '20px', padding: '15px 20px', position: 'sticky', top: '70px', zIndex: 10, backgroundColor: 'rgba(52, 73, 94, 0.95)', backdropFilter: 'blur(10px)' }}>
                <div className="flex align-center gap-15">
                    <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setSelectedClassId('')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedClass?.name}</h3>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ background: 'none', border: 'none', color: 'white', padding: 0, fontSize: '12px', opacity: 0.6, marginBottom: 0 }}
                        />
                    </div>
                </div>
                <div style={{ fontSize: '11px', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '5px', padding: '10px' }}>
                    <Save size={14} /> Guardado automático
                </div>
            </header>

            <div style={{ marginBottom: '20px', position: 'relative' }}>
                <div className="card" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                    <Search size={18} opacity={0.5} />
                    <input
                        type="text"
                        placeholder="Buscar para agregar Invitado / Recuperar..."
                        value={searchExtra}
                        onChange={(e) => setSearchExtra(e.target.value)}
                        style={{ marginBottom: 0, border: 'none', background: 'transparent', flex: 1, color: 'white' }}
                    />
                </div>
                {searchResults.length > 0 && (
                    <div className="card shadow-lg" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: '5px', padding: '5px', backgroundColor: 'var(--secondary-bg)', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        {searchResults.map(s => (
                            <div key={s.id} className="flex justify-between align-center" style={{ padding: '10px', borderRadius: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontWeight: 500 }}>{s.name}</span>
                                <div className="flex gap-10">
                                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => addExtraStudent(s, 'recovery')}>+ Recupera</button>
                                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px', color: '#f1c40f', borderColor: '#f1c40f' }} onClick={() => addExtraStudent(s, 'guest')}>+ Invitado</button>
                                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px', color: '#3498db', borderColor: '#3498db' }} onClick={() => enrollStudent(s)}>+ Grupo</button>
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
                                <th>Pago y Medio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleStudents.map(student => {
                                const rec = studentRecords[student.id] || { present: false, paymentAmount: 0, paymentMethod: '' };
                                const type = extraData[student.id];
                                const recAmount = Number(rec.paymentAmount);
                                const activePlan = studentMonthlyStatus[student.id];
                                const isS = recAmount === Number(selectedClass.classPrice) && recAmount > 0;
                                const is1xS = (recAmount === Number(selectedClass.monthlyPrice) && recAmount > 0) || (recAmount === 0 && activePlan?.plan === '1xS');
                                const is2xS = (recAmount === Number(selectedClass.monthly2xsPrice) && recAmount > 0) || (recAmount === 0 && activePlan?.plan === '2xS');
                                const showPaidNote = activePlan && recAmount === 0;
                                const activePlanMethod = (recAmount === 0 && activePlan) ? activePlan.paymentMethod : rec.paymentMethod;
                                const pColor = activePlanMethod === 'transfer' ? '#3498db' : '#2ecc71';
                                const pBg = activePlanMethod === 'transfer' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(46, 204, 113, 0.15)';
                                return (
                                    <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 15px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{student.name}</span>
                                                <div className="flex gap-5 mt-2">
                                                    {type === 'recovery' && <span style={{ fontSize: '9px', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '2px 5px', borderRadius: '3px' }}>RECUPERA</span>}
                                                    {type === 'guest' && <span style={{ fontSize: '9px', background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '2px 5px', borderRadius: '3px' }}>INVITADO</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => togglePresence(student.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: rec.present ? '#2ecc71' : '#bdc3c7' }}
                                            >
                                                {rec.present ? <CircleCheck size={28} /> : <Circle size={28} opacity={0.3} />}
                                            </button>
                                        </td>
                                        <td style={{ padding: '10px 5px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {/* Fila de Monto y Medios */}
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        value={rec.paymentAmount}
                                                        onChange={(e) => handleValueChange(student.id, 'paymentAmount', e.target.value)}
                                                        style={{ marginBottom: 0, padding: '10px', fontSize: '16px', textAlign: 'center', flex: 1, minWidth: '80px', fontWeight: 'bold' }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            onClick={() => handleValueChange(student.id, 'paymentMethod', 'cash')}
                                                            style={{ 
                                                                padding: '10px 4px', flex: 1, fontSize: '13px', justifyContent: 'center', fontWeight: 'bold',
                                                                ...((rec.paymentMethod === 'cash' || (showPaidNote && activePlan?.paymentMethod === 'cash')) ? { backgroundColor: '#2ecc71', color: 'white', borderColor: '#2ecc71', boxShadow: '0 2px 8px rgba(46, 204, 113, 0.4)' } : {}) 
                                                            }}
                                                        >
                                                            Efe
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary"
                                                            onClick={() => handleValueChange(student.id, 'paymentMethod', 'transfer')}
                                                            style={{ 
                                                                padding: '10px 4px', flex: 1, fontSize: '13px', justifyContent: 'center', fontWeight: 'bold',
                                                                ...((rec.paymentMethod === 'transfer' || (showPaidNote && activePlan?.paymentMethod === 'transfer')) ? { backgroundColor: '#3498db', color: 'white', borderColor: '#3498db', boxShadow: '0 2px 8px rgba(52, 152, 219, 0.4)' } : {}) 
                                                            }}
                                                        >
                                                            Trf
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Fila de Planes Rápidos */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '6px' }}>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ 
                                                            padding: '10px 4px', fontSize: '12px', justifyContent: 'center', fontWeight: '500',
                                                            ...(isS ? { borderColor: pColor, color: pColor, backgroundColor: pBg, borderWeight: '2px' } : {})
                                                        }}
                                                        onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.classPrice)}
                                                    >
                                                        S: ${selectedClass.classPrice}
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ 
                                                            padding: '10px 4px', fontSize: '12px', justifyContent: 'center', fontWeight: '500',
                                                            ...(is1xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg, borderWeight: '2px' } : {})
                                                        }}
                                                        onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthlyPrice)}
                                                    >
                                                        1xS
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ 
                                                            padding: '10px 4px', fontSize: '12px', justifyContent: 'center', fontWeight: '500',
                                                            ...(is2xS ? { borderColor: pColor, color: pColor, backgroundColor: pBg, borderWeight: '2px' } : {})
                                                        }}
                                                        onClick={() => handleValueChange(student.id, 'paymentAmount', selectedClass.monthly2xsPrice)}
                                                    >
                                                        2xS
                                                    </button>
                                                </div>

                                                {showPaidNote && (
                                                    <div style={{ fontSize: '11px', color: 'var(--success)', textAlign: 'center', marginTop: '-4px', fontWeight: '500' }}>
                                                        Abonado el {new Date(activePlan.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                    </div>
                                                )}

                                                {type && (
                                                    <button onClick={() => removeExtra(student.id)} style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.2)', color: '#e74c3c', cursor: 'pointer', fontSize: '11px', padding: '6px', borderRadius: '4px', marginTop: '2px' }}>
                                                        Quitar Alumno de la lista
                                                    </button>
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
