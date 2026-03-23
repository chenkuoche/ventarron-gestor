import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { UserPlus, Search, Edit2, Trash2, Mail, Phone, XCircle } from 'lucide-react';

const Students = () => {
    const { students, addStudent, deleteStudent, updateStudent, classes } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', enrolledClasses: [] });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            updateStudent(isEditing, formData);
            setIsEditing(null);
        } else {
            addStudent(formData);
        }
        setFormData({ name: '', phone: '', email: '', enrolledClasses: [] });
    };

    const handleEdit = (student) => {
        setIsEditing(student.id);
        setFormData({
            name: student.name,
            phone: student.phone,
            email: student.email,
            enrolledClasses: student.enrolledClasses || []
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setFormData({ name: '', phone: '', email: '', enrolledClasses: [] });
    };

    const toggleClass = (classId) => {
        setFormData(prev => {
            const current = prev.enrolledClasses || [];
            if (current.includes(classId)) {
                return { ...prev, enrolledClasses: current.filter(id => id !== classId) };
            } else {
                return { ...prev, enrolledClasses: [...current, classId] };
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
            <div className="flex-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '30px' }}>
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
                            {classes.map(cls => (
                                <label key={cls.id} className="flex align-center gap-10" style={{ cursor: 'pointer', margin: 0, color: 'white', fontSize: '14px' }}>
                                    <input
                                        type="checkbox"
                                        checked={(formData.enrolledClasses || []).includes(cls.id)}
                                        onChange={() => toggleClass(cls.id)}
                                        style={{ width: 'auto', marginBottom: 0 }}
                                    />
                                    {cls.name} ({cls.day})
                                </label>
                            ))}
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
                <div className="card">
                    <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                        <h3>Listado de Alumnos</h3>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', opacity: 0.5 }} />
                            <input
                                type="text"
                                placeholder="Buscar alumno..."
                                className="no-margin"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '35px', marginBottom: 0 }}
                            />
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Clases Inscritas</th>
                                    <th>Contacto</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => (
                                    <tr key={student.id} style={{ backgroundColor: isEditing === student.id ? 'rgba(52, 152, 219, 0.1)' : 'transparent' }}>
                                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {(student.enrolledClasses || []).map(id => {
                                                    const cls = classes.find(c => c.id === id);
                                                    return cls ? (
                                                        <span key={id} style={{ fontSize: '10px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {cls.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                                {(!student.enrolledClasses || student.enrolledClasses.length === 0) && <span style={{ fontSize: '10px', opacity: 0.3 }}>Sin clases</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-20" style={{ fontSize: '12px', opacity: 0.8 }}>
                                                <span className="flex align-center gap-10"><Phone size={14} /> {student.phone}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-10">
                                                <button
                                                    onClick={() => handleEdit(student)}
                                                    style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deleteStudent(student.id)}
                                                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={18} />
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
