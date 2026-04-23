import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { UserPlus, Search, Edit2, Trash2, Mail, Phone, XCircle, Calendar, History, PlusCircle, MessageCircle, CheckCircle } from 'lucide-react';

const Students = () => {
    const { students, addStudent, deleteStudent, updateStudent, classes, records, markWAReceiptSent, markWAReminderSent } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(null);
    const [viewHistory, setViewHistory] = useState(null);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', enrolledClasses: [], guestClasses: [] });
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        filterClass: 'all',
        columns: {
            name: true,
            phone: true,
            email: true,
            enrolledClasses: true,
            guestClasses: false
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            updateStudent(isEditing, formData);
            setIsEditing(null);
        } else {
            addStudent(formData);
        }
        setFormData({ name: '', phone: '', email: '', enrolledClasses: [], guestClasses: [] });
    };

    const handleEdit = (student) => {
        setIsEditing(student.id);
        setFormData({
            name: student.name,
            phone: student.phone,
            email: student.email,
            enrolledClasses: student.enrolledClasses || [],
            guestClasses: student.guestClasses || []
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setFormData({ name: '', phone: '', email: '', enrolledClasses: [], guestClasses: [] });
    };

    const toggleClass = (classId, type = 'regular') => {
        setFormData(prev => {
            const enrolled = prev.enrolledClasses || [];
            const guests = prev.guestClasses || [];
            
            if (type === 'regular') {
                if (enrolled.includes(classId)) {
                    return { ...prev, enrolledClasses: enrolled.filter(id => id !== classId) };
                } else {
                    return { 
                        ...prev, 
                        enrolledClasses: [...enrolled, classId],
                        guestClasses: guests.filter(id => id !== classId) // Quitar de invitados si se une al grupo
                    };
                }
            } else {
                if (guests.includes(classId)) {
                    return { ...prev, guestClasses: guests.filter(id => id !== classId) };
                } else {
                    return { 
                        ...prev, 
                        guestClasses: [...guests, classId],
                        enrolledClasses: enrolled.filter(id => id !== classId) // Quitar del grupo si es invitado
                    };
                }
            }
        });
    };

    const handleSendWA = (student, type, data = {}) => {
        const phoneRaw = student.phone || '';
        const phone = phoneRaw.replace(/\D/g, '');
        if (!phone) {
            alert("Este alumno no tiene teléfono registrado.");
            return;
        }

        const currentMonthName = months[new Date().getMonth()];
        const selClass = classes.find(c => (student.enrolledClasses || []).includes(c.id));

        let text = "";
        if (type === 'debt') {
            const price = selClass ? ((student.enrolledClasses || []).length > 1 ? selClass.monthly2xsPrice : selClass.monthlyPrice) : "---";
            text = `Hola ${student.name}!\n\n¿Cómo estás? Te escribimos de Ventarrón para recordarte que el saldo del mes de ${currentMonthName} para la clase de ${selClass?.name || 'tango'} quedó pendiente ($${price}).\n\nSi ya transferiste, por favor envíanos el comprobante.\n\n¡Nos vemos en pista!`;
        } else if (type === 'receipt') {
            const amount = Number(data.amount);
            let concept = "";
            const recClass = classes.find(c => c.id === data.classId) || selClass;
            if (recClass) {
                if (amount === Number(recClass.monthlyPrice)) concept = "la mensualidad correspondiente a una clase semanal";
                else if (amount === Number(recClass.monthly2xsPrice)) concept = "la mensualidad correspondiente a dos clases semanales";
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
            markWAReceiptSent(data.date, data.classId || selClass?.id, student.id);
        }
    };

    const handleExport = () => {
        let filtered = [...students].sort((a,b) => a.name.localeCompare(b.name));
        if (exportConfig.filterClass !== 'all') {
            filtered = filtered.filter(s => 
                (s.enrolledClasses || []).includes(exportConfig.filterClass) || 
                (s.guestClasses || []).includes(exportConfig.filterClass)
            );
        }

        // Generar CSV
        const headers = [];
        if (exportConfig.columns.name) headers.push('Nombre');
        if (exportConfig.columns.phone) headers.push('Teléfono');
        if (exportConfig.columns.email) headers.push('Email');
        if (exportConfig.columns.enrolledClasses) headers.push('Grupos Regulares');
        if (exportConfig.columns.guestClasses) headers.push('Grupos Invitado');

        const rows = filtered.map(s => {
            const row = [];
            // Usamos punto y coma para separar celdas y evitar problemas con comas en nombres/clases
            if (exportConfig.columns.name) row.push(`"${s.name}"`);
            if (exportConfig.columns.phone) row.push(`"${s.phone || ''}"`);
            if (exportConfig.columns.email) row.push(`"${s.email || ''}"`);
            if (exportConfig.columns.enrolledClasses) {
                const names = (s.enrolledClasses || []).map(id => classes.find(c => c.id === id)?.name || id).join(', ');
                row.push(`"${names}"`);
            }
            if (exportConfig.columns.guestClasses) {
                const names = (s.guestClasses || []).map(id => classes.find(c => c.id === id)?.name || id).join(', ');
                row.push(`"${names}"`);
            }
            return row.join(';');
        });

        const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n'); // \uFEFF es para que Excel reconozca tildes (UTF-8)
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const fileName = exportConfig.filterClass === 'all' 
            ? 'lista_alumnos_ventarron.csv' 
            : `lista_${classes.find(c => c.id === exportConfig.filterClass)?.name.replace(/ /g, '_')}.csv`;
        link.setAttribute('download', fileName);
        link.click();
        setShowExportModal(false);
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone || '').includes(searchTerm)
    );

    return (
        <div className="students-page">
            <div className="students-grid">
                {/* Form to Add/Edit */}
                <div className="card" style={{
                    height: 'fit-content',
                    border: isEditing ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: isEditing ? '0 0 20px rgba(52, 152, 219, 0.2)' : 'none'
                }}>
                    <div className="flex justify-between align-center">
                        <h3 style={{ color: isEditing ? '#3498db' : 'inherit' }}>
                            {isEditing ? 'Editando Alumno' : 'Inscribir Alumno'}
                        </h3>
                        {isEditing && (
                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                                <XCircle size={20} />
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                        <label>Nombre Completo</label>
                        <input
                            type="text"
                            required
                            placeholder="Nombre del alumno"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <label>Teléfono</label>
                        <input
                            type="tel"
                            required
                            placeholder="Ej: +598 123 456"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />

                        <label>Email</label>
                        <input
                            type="email"
                            required
                            placeholder="ejemplo@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />

                        <label style={{ marginTop: '10px' }}>Inscribir en Clases:</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            {classes.filter(c => !c.isPractice).map(cls => {
                                const isEnrolled = (formData.enrolledClasses || []).includes(cls.id);
                                const isGuest = (formData.guestClasses || []).includes(cls.id);
                                return (
                                    <div key={cls.id} className="student-enroll-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: '10px' }}>
                                        <span style={{ fontSize: '13px', color: (isEnrolled || isGuest) ? 'white' : 'rgba(255,255,255,0.4)', flex: 1, minWidth: '140px' }}>
                                            {cls.name}
                                        </span>
                                        <div className="flex gap-10">
                                            <button 
                                                type="button"
                                                onClick={() => toggleClass(cls.id, 'regular')}
                                                style={{ 
                                                    padding: '6px 12px', fontSize: '11px', borderRadius: '4px', border: '1px solid',
                                                    backgroundColor: isEnrolled ? '#3498db' : 'transparent',
                                                    borderColor: isEnrolled ? '#3498db' : 'rgba(255,255,255,0.1)',
                                                    color: isEnrolled ? 'white' : 'rgba(255,255,255,0.5)',
                                                    cursor: 'pointer',
                                                    minWidth: '70px'
                                                }}
                                            >
                                                GRUPO
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => toggleClass(cls.id, 'guest')}
                                                style={{ 
                                                    padding: '6px 12px', fontSize: '11px', borderRadius: '4px', border: '1px solid',
                                                    backgroundColor: isGuest ? '#f1c40f' : 'transparent',
                                                    borderColor: isGuest ? '#f1c40f' : 'rgba(255,255,255,0.1)',
                                                    color: isGuest ? 'black' : 'rgba(255,255,255,0.5)',
                                                    cursor: 'pointer',
                                                    minWidth: '70px'
                                                }}
                                            >
                                                INVITADO
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {classes.filter(c => !c.isPractice).length === 0 && <p style={{ fontSize: '12px', opacity: 0.5 }}>No hay clases regulares creadas.</p>}
                        </div>

                        <div className="flex gap-10" style={{ marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                                <UserPlus size={18} />
                                {isEditing ? 'Guardar Cambios' : 'Registrar'}
                            </button>
                            {!isEditing && (
                                <button type="button" onClick={() => setShowExportModal(true)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', opacity: 0.8 }}>
                                    Descargar Lista
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List of Students */}
                <div className="card" style={{ flex: 1, padding: '15px' }}>
                    <div className="card-header-responsive" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <h3 style={{ margin: 0, flex: '1 0 100%', marginBottom: '10px' }}>Listado de Alumnos</h3>
                        <div style={{ position: 'relative', flex: '1', minWidth: '150px', maxWidth: '100%' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', opacity: 0.5 }} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="no-margin"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '35px', marginBottom: 0, padding: '10px 10px 10px 35px', fontSize: '14px' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ minWidth: '500px', tableLayout: 'fixed', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '10px' }}>Alumno / Email</th>
                                    <th style={{ padding: '10px' }}>Grupos</th>
                                    <th style={{ padding: '10px', textAlign: 'center', minWidth: '100px' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => (
                                    <tr key={student.id} style={{ backgroundColor: isEditing === student.id ? 'rgba(52, 152, 219, 0.1)' : 'transparent' }}>
                                        <td 
                                            style={{ padding: '15px 10px', cursor: 'pointer' }}
                                            onClick={() => setViewHistory(student)}
                                        >
                                            <div className="no-underline" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '16px', color: '#fff', textDecoration: 'none' }}>{student.name}</span>
                                                {student.email && <span style={{ fontSize: '12px', opacity: 0.4, textDecoration: 'none' }}>{student.email}</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {(student.enrolledClasses || []).map(id => {
                                                    const cls = classes.find(c => c.id === id);
                                                    if (!cls) return null;
                                                    return (
                                                        <span key={id} style={{
                                                            fontSize: '10px', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold',
                                                            background: cls.day.toLowerCase().includes('martes') ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                                                            color: cls.day.toLowerCase().includes('martes') ? '#2ecc71' : '#f1c40f'
                                                        }}>
                                                            {cls.name}
                                                        </span>
                                                    );
                                                })}
                                                {(!student.enrolledClasses || student.enrolledClasses.length === 0) && <span style={{ opacity: 0.2 }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px 5px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', justifyContent: 'center', minWidth: '120px' }}>
                                                {student.phone && (
                                                    <a 
                                                        href={`https://wa.me/${student.phone.replace(/\D/g, '')}`} 
                                                        target="_blank" rel="noopener noreferrer" 
                                                        style={{ color: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <MessageCircle size={22} />
                                                    </a>
                                                )}
                                                <button onClick={() => handleEdit(student)} style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Edit2 size={20} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`¿Eliminar a ${student.name}?`)) deleteStudent(student.id);
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>
                                            No se encontraron alumnos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Historial */}
            {viewHistory && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
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
                                                        {isGuest && <span style={{ fontSize: '9px', background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>INVITADO</span>}
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const msg = isGuest 
                                                                ? `¿Deseas quitar a este alumno de la lista de invitados de ${cls?.name || cid}?`
                                                                : `¿Deseas dar de baja a este alumno del grupo ${cls?.name || cid}?`;
                                                            if (window.confirm(msg)) {
                                                                const updates = {};
                                                                if (isGuest) {
                                                                    updates.guestClasses = (viewHistory.guestClasses || []).filter(id => id !== cid);
                                                                } else {
                                                                    updates.enrolledClasses = (viewHistory.enrolledClasses || []).filter(id => id !== cid);
                                                                }
                                                                updateStudent(viewHistory.id, updates);
                                                                setViewHistory({ ...viewHistory, ...updates });
                                                            }
                                                        }} 
                                                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
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
                                            {classes.filter(c => !c.isPractice && !(viewHistory.enrolledClasses || []).includes(c.id)).map(c => (
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
                                                        <div className="flex align-center gap-5">
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
            {/* Modal de Exportación */}
            {showExportModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Exportar Alumnos</h3>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px', display: 'block' }}>FILTRAR POR GRUPO</label>
                            <select 
                                value={exportConfig.filterClass}
                                onChange={(e) => setExportConfig({ ...exportConfig, filterClass: e.target.value })}
                                style={{ marginBottom: 0 }}
                            >
                                <option value="all">Todos los alumnos</option>
                                {classes.filter(c => !c.isPractice).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ fontSize: '12px', opacity: 0.6, marginBottom: '12px', display: 'block' }}>DATOS A INCLUIR</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                {[
                                    { id: 'name', label: 'Nombre Completo' },
                                    { id: 'phone', label: 'Teléfono' },
                                    { id: 'email', label: 'Email' },
                                    { id: 'enrolledClasses', label: 'Grupos Regulares' },
                                    { id: 'guestClasses', label: 'Grupos Invitado' }
                                ].map(col => (
                                    <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={exportConfig.columns[col.id]} 
                                            onChange={(e) => setExportConfig({
                                                ...exportConfig,
                                                columns: { ...exportConfig.columns, [col.id]: e.target.checked }
                                            })}
                                            style={{ margin: 0, width: '18px', height: '18px' }}
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={handleExport} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>DESCARGAR CSV</button>
                            <button className="btn btn-secondary" onClick={() => setShowExportModal(false)} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Students;
