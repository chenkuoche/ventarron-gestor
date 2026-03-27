import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Calendar, Plus, Trash2, Edit2, Wallet, XCircle } from 'lucide-react';

const Classes = () => {
    const { classes, addClass, deleteClass, updateClass } = useAppContext();
    const [isEditing, setIsEditing] = useState(null);
    const [formData, setFormData] = useState({
        name: '', day: 'Martes', time: '19:00', endTime: '20:30', profitSplit: 1, rent: 0,
        classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            updateClass(isEditing, formData);
            setIsEditing(null);
        } else {
            addClass(formData);
        }
        setFormData({ name: '', day: 'Martes', time: '19:00', endTime: '20:30', profitSplit: 1, rent: 0, classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500 });
    };

    const handleEdit = (cls) => {
        setIsEditing(cls.id);
        setFormData({
            name: cls.name, day: cls.day, time: cls.time, endTime: cls.endTime,
            profitSplit: cls.profitSplit, rent: cls.rent,
            classPrice: cls.classPrice || 0,
            monthlyPrice: cls.monthlyPrice || 0,
            monthly2xsPrice: cls.monthly2xsPrice || 0
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setFormData({ name: '', day: 'Martes', time: '19:00', endTime: '20:30', profitSplit: 1, rent: 0, classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500 });
    };

    const rowStyle = { display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' };
    const fieldStyle = { flex: '1 1 160px', minWidth: '160px' };

    return (
        <div className="classes-page">
            <div className="flex-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
                {/* Form to Add/Edit */}
                <div className="card" style={{
                    height: 'fit-content',
                    border: isEditing ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div className="flex justify-between align-center">
                        <h3 style={{ color: isEditing ? '#3498db' : 'inherit', margin: 0 }}>
                            {isEditing ? 'Editando Clase' : 'Crear Nueva Clase'}
                        </h3>
                        {isEditing && (
                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                                <XCircle size={20} />
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                        <label>Nombre de la Clase</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: Martes Nivel 1"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <div className="mobile-form-row">
                            <div style={{ width: '100%', maxWidth: '100%' }}>
                                <label>Día</label>
                                <select
                                    value={formData.day}
                                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                                >
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ width: '100%', maxWidth: '100%' }}>
                                <label>Hora Inicio</label>
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="mobile-form-row">
                            <div style={{ width: '100%', maxWidth: '100%' }}>
                                <label>Hora Fin</label>
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                />
                            </div>
                            <div style={{ width: '100%', maxWidth: '100%' }}>
                                <label>Alquiler / clase ($)</label>
                                <input
                                    type="number"
                                    value={formData.rent}
                                    onChange={(e) => setFormData({ ...formData, rent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <div style={{ flex: '1 1 100%' }}>
                                <label>Ganancia (Usuario)</label>
                                <select
                                    value={formData.profitSplit}
                                    onChange={(e) => setFormData({ ...formData, profitSplit: parseFloat(e.target.value) })}
                                >
                                    <option value={1}>100% (Ganancia total)</option>
                                    <option value={0.5}>50% (Con un colega)</option>
                                    <option value={0.33}>33.3% (Tres profesores)</option>
                                </select>
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <div style={fieldStyle}>
                                <label>Precio Clase Suelta ($)</label>
                                <input
                                    type="number"
                                    value={formData.classPrice}
                                    onChange={(e) => setFormData({ ...formData, classPrice: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <div style={fieldStyle}>
                                <label>Mensual 1 x Sem ($)</label>
                                <input
                                    type="number"
                                    value={formData.monthlyPrice}
                                    onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div style={fieldStyle}>
                                <label>Mensual 2 x Sem ($)</label>
                                <input
                                    type="number"
                                    value={formData.monthly2xsPrice}
                                    onChange={(e) => setFormData({ ...formData, monthly2xsPrice: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-10" style={{ marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                                <Plus size={18} />
                                {isEditing ? 'Guardar Cambios' : 'Crear Clase'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List of Classes */}
                <div className="card">
                    <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                        <h3>Tus Horarios</h3>
                    </div>

                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table style={{ minWidth: '400px' }}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Precios</th>
                                    <th style={{ textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map(cls => (
                                    <tr key={cls.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ fontWeight: 600 }}>{cls.name}</td>
                                        <td>
                                            <div style={{ fontSize: '11px' }}>
                                                Suelta: <span style={{ color: '#2ecc71' }}>${cls.classPrice}</span><br />
                                                1XS: <span style={{ color: '#3498db' }}>${cls.monthlyPrice}</span><br />
                                                2XS: <span style={{ color: '#3498db' }}>${cls.monthly2xsPrice}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex gap-10 justify-center">
                                                <button
                                                    onClick={() => handleEdit(cls)}
                                                    style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`¿Estás seguro de ELIMINAR la clase "${cls.name}"? Esto también podría afectar los registros de asistencia asociados.`)) {
                                                            deleteClass(cls.id);
                                                        }
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Classes;
