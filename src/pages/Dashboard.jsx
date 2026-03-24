import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, Wallet, Calendar, TrendingUp, ArrowUpRight, Clock, MapPin } from 'lucide-react';

const Dashboard = () => {
    const { students, classes, records, clearAllRecords, setActivePage, setSelectedClassId } = useAppContext();

    const handleClearDb = async () => {
        if (window.confirm('¿Estás seguro de que quieres borrar TODOS los registros de asistencia y pagos? Esta acción no se puede deshacer.')) {
            try {
                await clearAllRecords();
            } catch (error) {
                console.error(error);
                alert('Error al limpiar la base de datos.');
            }
        }
    };

    const handleViewList = (classId) => {
        setSelectedClassId(classId);
        setActivePage('Asistencia y Pagos');
    };

    // Current month stats
    const today = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[today.getDay()];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const currentMonthRecords = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    const totalIncome = currentMonthRecords.reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);
    const totalCash = currentMonthRecords
        .filter(r => r.paymentMethod === 'cash')
        .reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);
    const totalTransfer = currentMonthRecords
        .filter(r => r.paymentMethod === 'transfer')
        .reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);

    const todayClasses = classes.filter(c => c.day === todayName);

    const stats = [
        { label: 'Total (Mes)', value: `$${totalIncome.toLocaleString()}`, icon: Wallet, color: '#e74c3c' },
        { label: 'Alumnos', value: students.length, icon: Users, color: '#3498db' },
        { label: 'Efectivo', value: `$${totalCash.toLocaleString()}`, icon: TrendingUp, color: '#2ecc71' },
        { label: 'Transfer.', value: `$${totalTransfer.toLocaleString()}`, icon: TrendingUp, color: '#f1c40f' }
    ];

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T12:00:00');
        const day = date.getDate();
        const month = date.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
        return `${day} ${month}`;
    };

    return (
        <div className="dashboard" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>¡Hola, Ventarrón! 🌪️</h2>
                    <p style={{ margin: '5px 0 0', opacity: 0.5, fontSize: '14px' }}>Aquí tienes un resumen de lo que va del mes.</p>
                </div>
                <button 
                    onClick={handleClearDb}
                    style={{ 
                        backgroundColor: 'rgba(231, 76, 60, 0.1)', 
                        color: '#e74c3c', 
                        border: '1px solid rgba(231, 76, 60, 0.2)', 
                        padding: '8px 12px', 
                        borderRadius: '6px', 
                        fontSize: '10px',
                        cursor: 'pointer'
                    }}
                >
                    Limpiar Datos
                </button>
            </header>

            <div className="grid-stats" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '35px'
            }}>
                {stats.map((stat, idx) => (
                    <div key={idx} className="card shadow-md flex-column align-center justify-center" style={{ marginBottom: 0, padding: '15px', position: 'relative', textAlign: 'center' }}>
                        <div style={{
                            backgroundColor: `${stat.color}15`,
                            color: stat.color,
                            padding: '10px',
                            borderRadius: '10px',
                            marginBottom: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <stat.icon size={20} />
                        </div>
                        <p style={{ fontSize: '10px', color: '#bdc3c7', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{stat.value}</h2>
                    </div>
                ))}
            </div>

            <div className="grid-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <section>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                            <Calendar size={18} color="#e74c3c" /> Clases de Hoy ({todayName})
                        </h3>
                    </div>
                    {todayClasses.length > 0 ? (
                        <div className="flex flex-column gap-10">
                            {todayClasses.map(cls => (
                                <div key={cls.id} className="card glass-card shadow-sm" style={{ padding: '15px', borderLeft: '4px solid #3498db', marginBottom: 0 }}>
                                    <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1rem' }}>{cls.name}</h4>
                                            <div className="flex gap-10 mt-5" style={{ opacity: 0.6, fontSize: '11px' }}>
                                                <span className="flex align-center gap-5"><Clock size={12} /> {cls.time} - {cls.endTime}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleViewList(cls.id)}
                                            className="btn btn-primary" 
                                            style={{ padding: '6px 12px', fontSize: '11px', flex: '1', minWidth: '80px', textAlign: 'center', justifyContent: 'center' }}
                                        >
                                            Ver Lista
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: '30px', opacity: 0.5, fontSize: '13px' }}>
                            No hay clases hoy.
                        </div>
                    )}
                </section>

                <section>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                            <TrendingUp size={18} color="#2ecc71" /> Últimos Pagos
                        </h3>
                    </div>
                    <div className="card shadow-sm" style={{ padding: '5px 0', marginBottom: 0 }}>
                        {currentMonthRecords.length > 0 ? (
                            <div className="flex flex-column">
                                {currentMonthRecords.slice(-6).reverse().map((r, i) => {
                                    const student = students.find(s => s.id === r.studentId);
                                    const cls = classes.find(c => c.id === r.classId);
                                    return (
                                        <div key={i} className="flex justify-between align-center" style={{
                                            padding: '10px 15px',
                                            borderBottom: i === currentMonthRecords.slice(-6).length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                            background: r.paymentAmount > 0 ? (r.paymentMethod === 'transfer' ? 'rgba(52, 152, 219, 0.03)' : 'rgba(46, 204, 113, 0.02)') : 'transparent'
                                        }}>
                                            <div style={{ maxWidth: '65%' }}>
                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student?.name || 'Invitado'}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                    <span style={{ fontSize: '9px', opacity: 0.4 }}>{cls?.name.split(' ')[0]}</span>
                                                    <span style={{ height: '2px', width: '2px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }}></span>
                                                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#bdc3c7' }}>{formatDate(r.date)}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, fontWeight: 700, color: r.paymentAmount > 0 ? (r.paymentMethod === 'transfer' ? '#3498db' : '#2ecc71') : 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                                                    {r.paymentAmount > 0 ? `+$${r.paymentAmount}` : '$0'}
                                                </p>
                                                {(r.paymentMethod === 'cash' || r.paymentMethod === 'transfer') && (
                                                    <span style={{ 
                                                        display: 'inline-block', 
                                                        padding: '1px 5px', 
                                                        borderRadius: '3px', 
                                                        fontSize: '8px', 
                                                        fontWeight: 'bold',
                                                        backgroundColor: r.paymentMethod === 'cash' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(52, 152, 219, 0.2)',
                                                        color: r.paymentMethod === 'cash' ? '#2ecc71' : '#3498db'
                                                    }}>
                                                        {r.paymentMethod === 'cash' ? 'EFE' : 'TRF'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.4, fontSize: '13px' }}>
                                Sin movimientos este mes.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
