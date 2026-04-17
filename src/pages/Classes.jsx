import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Calendar, Plus, Trash2, Edit2, Wallet, XCircle, Users, ChevronRight } from 'lucide-react';

const Classes = () => {
    const { classes, addClass, deleteClass, updateClass, setActivePage, setSelectedClassId, selectedDate, setSelectedDate } = useAppContext();
    const [activeTab, setActiveTab] = useState('regular'); // 'regular' | 'practice'
    const [isEditing, setIsEditing] = useState(null);
    const [formData, setFormData] = useState({
        name: '', day: 'Martes', time: '19:00', endTime: '20:30', profitSplit: 1, rent: 0,
        classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500, plPrice: 249,
        isPractice: false, date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            isPractice: activeTab === 'practice'
        };
        
        if (isEditing) {
            updateClass(isEditing, dataToSave);
            setIsEditing(null);
        } else {
            addClass(dataToSave);
        }
        resetForm();
    };

    const resetForm = () => {
        setFormData({ 
            name: '', day: 'Martes', time: '19:00', endTime: '20:30', profitSplit: 1, rent: 0, 
            classPrice: 800, monthlyPrice: 3000, monthly2xsPrice: 4500, plPrice: 249,
            isPractice: false, date: new Date().toISOString().split('T')[0]
        });
    };

    const handleEdit = (cls) => {
        setIsEditing(cls.id);
        setActiveTab(cls.isPractice ? 'practice' : 'regular');
        setFormData({
            name: cls.name, day: cls.day || 'Martes', time: cls.time || '19:00', endTime: cls.endTime || '20:30',
            profitSplit: cls.profitSplit || 1, rent: cls.rent || 0,
            classPrice: cls.classPrice || 0,
            monthlyPrice: cls.monthlyPrice || 0,
            monthly2xsPrice: cls.monthly2xsPrice || 0,
            plPrice: cls.plPrice || 249,
            isPractice: cls.isPractice || false,
            date: cls.date || new Date().toISOString().split('T')[0]
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setIsEditing(null);
        resetForm();
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
                            {isEditing ? 'Editando' : 'Crear Nuevo'}
                        </h3>
                        {isEditing && (
                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                                <XCircle size={20} />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-10" style={{ marginTop: '20px', background: 'rgba(255,255,255,0.03)', padding: '5px', borderRadius: '8px' }}>
                        <button 
                            onClick={() => { if(!isEditing) setActiveTab('regular'); }} 
                            style={{ 
                                flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: isEditing ? 'default' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                                background: activeTab === 'regular' ? '#3498db' : 'transparent',
                                color: activeTab === 'regular' ? 'white' : 'rgba(255,255,255,0.5)',
                                opacity: isEditing && activeTab !== 'regular' ? 0.3 : 1
                            }}
                        >GRUPOS</button>
                        <button 
                            onClick={() => { if(!isEditing) setActiveTab('practice'); }} 
                            style={{ 
                                flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: isEditing ? 'default' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                                background: activeTab === 'practice' ? '#f1c40f' : 'transparent',
                                color: activeTab === 'practice' ? 'black' : 'rgba(255,255,255,0.5)',
                                opacity: isEditing && activeTab !== 'practice' ? 0.3 : 1
                            }}
                        >PRÁCTICAS / EVENTOS</button>
                    </div>

                    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                        <label>{activeTab === 'regular' ? 'Nombre de la Clase' : 'Nombre de la Práctica'}</label>
                        <input
                            type="text"
                            required
                            placeholder={activeTab === 'regular' ? "Ej: Martes Nivel 1" : "Ej: Práctica de Mayo"}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        {activeTab === 'regular' ? (
                            <>
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
                                        <label>Clase Suelta ($)</label>
                                        <input
                                            type="number"
                                            value={formData.classPrice}
                                            onChange={(e) => setFormData({ ...formData, classPrice: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div style={fieldStyle}>
                                        <label>Pase Libre ($)</label>
                                        <input
                                            type="number"
                                            value={formData.plPrice}
                                            onChange={(e) => setFormData({ ...formData, plPrice: parseFloat(e.target.value) || 0 })}
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
                            </>
                        ) : (
                            <>
                                <label>Fecha del Evento</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                                <div className="mobile-form-row">
                                    <div style={{ width: '100%', maxWidth: '100%' }}>
                                        <label>Costo Alumno ($)</label>
                                        <input
                                            type="number"
                                            required
                                            value={formData.classPrice}
                                            onChange={(e) => setFormData({ ...formData, classPrice: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div style={{ width: '100%', maxWidth: '100%' }}>
                                        <label>Alquiler ($)</label>
                                        <input
                                            type="number"
                                            required
                                            value={formData.rent}
                                            onChange={(e) => setFormData({ ...formData, rent: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex gap-10" style={{ marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', backgroundColor: activeTab === 'practice' ? '#f1c40f' : '', color: activeTab === 'practice' ? 'black' : '' }}>
                                {activeTab === 'regular' ? <Plus size={18} /> : <Calendar size={18} />}
                                {isEditing ? 'Guardar Cambios' : (activeTab === 'regular' ? 'Crear Clase' : 'Crear Práctica')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List of Classes */}
                <div className="card">
                    <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                        <h3>{activeTab === 'regular' ? 'Grupos Regulares' : 'Prácticas / Eventos'}</h3>
                    </div>

                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table style={{ minWidth: '400px' }}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>{activeTab === 'regular' ? 'Horario / Precios' : 'Fecha / Costos'}</th>
                                    <th style={{ textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.filter(c => activeTab === 'regular' ? !c.isPractice : c.isPractice).map(cls => (
                                    <tr 
                                        key={cls.id} 
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                                        onClick={() => {
                                            if (cls.isPractice && cls.date) {
                                                if (cls.date !== selectedDate) {
                                                    if (window.confirm(`Este evento está programado para el ${new Date(cls.date + 'T12:00:00').toLocaleDateString('es-UY')}. ¿Deseas cambiar a esa fecha?`)) {
                                                        setSelectedDate(cls.date);
                                                    }
                                                }
                                            }
                                            setSelectedClassId(cls.id);
                                            setActivePage('Asistencia y Pagos');
                                        }}
                                        className="class-row-hover"
                                    >
                                        <td style={{ fontWeight: 600 }}>
                                            {cls.name}
                                            {cls.isPractice && <div style={{ fontSize: '10px', opacity: 0.5 }}>Evento Único</div>}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '11px' }}>
                                                {cls.isPractice ? (
                                                    <>
                                                        Fecha: <span style={{ color: '#f1c40f' }}>{new Date(cls.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}</span><br />
                                                        Costo: <span style={{ color: '#2ecc71' }}>${cls.classPrice}</span><br />
                                                        Alquiler: <span style={{ color: '#e74c3c' }}>${cls.rent}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {cls.day} {cls.time}hs<br />
                                                        1XS: <span style={{ color: '#3498db' }}>${cls.monthlyPrice}</span> | 
                                                        PL: <span style={{ color: '#9b59b6' }}>${cls.plPrice || 249}</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className="flex gap-10 justify-center">
                                                <button
                                                    onClick={() => handleEdit(cls)}
                                                    style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`¿Estás seguro de ELIMINAR ${cls.isPractice ? 'la práctica' : 'la clase'} "${cls.name}"?`)) {
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
                                {classes.filter(c => activeTab === 'regular' ? !c.isPractice : c.isPractice).length === 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                                            No hay {activeTab === 'regular' ? 'grupos' : 'prácticas'} creadas.
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

export default Classes;
