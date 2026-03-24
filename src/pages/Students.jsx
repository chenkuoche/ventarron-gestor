import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { UserPlus, Search, Edit2, Trash2, Mail, Phone, XCircle } from 'lucide-react';

const Students = () => {
    const { students, addStudent, deleteStudent, updateStudent, classes } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', enrolledClasses: [], guestClasses: [] });

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

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm)
    );

    return (
        <div className="students-page">
            <div className="flex-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
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
                            {classes.map(cls => {
                                const isEnrolled = (formData.enrolledClasses || []).includes(cls.id);
                                const isGuest = (formData.guestClasses || []).includes(cls.id);
                                return (
                                    <div key={cls.id} className="flex align-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', flexWrap: 'wrap', gap: '10px' }}>
                                        <span style={{ fontSize: '13px', color: (isEnrolled || isGuest) ? 'white' : 'rgba(255,255,255,0.4)', flex: 1, minWidth: '120px' }}>
                                            {cls.name}
                                        </span>
                                        <div className="flex gap-5">
                                            <button 
                                                type="button"
                                                onClick={() => toggleClass(cls.id, 'regular')}
                                                style={{ 
                                                    padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid',
                                                    backgroundColor: isEnrolled ? '#3498db' : 'transparent',
                                                    borderColor: isEnrolled ? '#3498db' : 'rgba(255,255,255,0.1)',
                                                    color: isEnrolled ? 'white' : 'rgba(255,255,255,0.5)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                GRUPO
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => toggleClass(cls.id, 'guest')}
                                                style={{ 
                                                    padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid',
                                                    backgroundColor: isGuest ? '#f1c40f' : 'transparent',
                                                    borderColor: isGuest ? '#f1c40f' : 'rgba(255,255,255,0.1)',
                                                    color: isGuest ? 'black' : 'rgba(255,255,255,0.5)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                INVITADO
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {classes.length === 0 && <p style={{ fontSize: '12px', opacity: 0.5 }}>No hay clases creadas.</p>}
                        </div>

                        <div className="flex gap-10" style={{ marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                <UserPlus size={18} />
                                {isEditing ? 'Guardar Cambios' : 'Registrar'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List of Students */}
                <div className="card" style={{ flex: 1, padding: '15px' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Listado de Alumnos</h3>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '250px' }}>
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

                    <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ minWidth: '500px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '10px' }}>Nombre</th>
                                    <th style={{ padding: '10px' }}>Clases</th>
                                    <th style={{ padding: '10px' }}>Cel</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => (
                                    <tr key={student.id} style={{ backgroundColor: isEditing === student.id ? 'rgba(52, 152, 219, 0.1)' : 'transparent' }}>
                                        <td style={{ fontWeight: 600, fontSize: '13px', padding: '10px' }}>{student.name}</td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {(student.enrolledClasses || []).map(id => {
                                                    const cls = classes.find(c => c.id === id);
                                                    if (!cls) return null;

                                                    let badgeStyle = {
                                                        fontSize: '9px',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontWeight: '500',
                                                        display: 'inline-block',
                                                        width: 'fit-content'
                                                    };

                                                    const day = (cls.day || '').toLowerCase();
                                                    if (day.includes('martes')) {
                                                        const isLater = (cls.time || '').includes('20') || (cls.time || '').includes('21');
                                                        badgeStyle.background = isLater ? 'rgba(39, 174, 96, 0.25)' : 'rgba(46, 204, 113, 0.25)';
                                                        badgeStyle.color = isLater ? '#27ae60' : '#2ecc71';
                                                    } else if (day.includes('jueves')) {
                                                        const isLater = (cls.time || '').includes('20') || (cls.time || '').includes('21');
                                                        badgeStyle.background = isLater ? 'rgba(243, 156, 18, 0.25)' : 'rgba(241, 196, 15, 0.25)';
                                                        badgeStyle.color = isLater ? '#f39c12' : '#f1c40f';
                                                    } else {
                                                        badgeStyle.background = 'rgba(52, 152, 219, 0.2)';
                                                        badgeStyle.color = '#3498db';
                                                    }

                                                    return (
                                                        <span key={id} style={badgeStyle}>
                                                            {cls.name}
                                                        </span>
                                                    );
                                                })}
                                                {(student.guestClasses || []).map(id => {
                                                    const cls = classes.find(c => c.id === id);
                                                    if (!cls) return null;
                                                    return (
                                                        <span key={id} style={{
                                                            fontSize: '9px',
                                                            padding: '2px 6px',
                                                            borderRadius: '3px',
                                                            fontWeight: '700',
                                                            display: 'inline-block',
                                                            width: 'fit-content',
                                                            background: 'rgba(241, 196, 15, 0.15)',
                                                            color: '#f1c40f',
                                                            border: '1px solid rgba(241, 196, 15, 0.2)'
                                                        }}>
                                                            INV: {cls.name}
                                                        </span>
                                                    );
                                                })}
                                                {(!student.enrolledClasses || student.enrolledClasses.length === 0) && (!student.guestClasses || student.guestClasses.length === 0) && <span style={{ fontSize: '10px', opacity: 0.3 }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '12px', opacity: 0.8, padding: '10px' }}>
                                            <div className="flex align-center gap-5">
                                                <Phone size={12} /> {student.phone.slice(-4)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <div className="flex gap-5 justify-center">
                                                <button
                                                    onClick={() => handleEdit(student)}
                                                    style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', padding: '5px' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteStudent(student.id)}
                                                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '5px' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>
                                            No se encontraron alumnos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Students;
