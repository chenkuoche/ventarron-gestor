import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, Wallet, Calendar, TrendingUp, ArrowUpRight, Clock, MapPin } from 'lucide-react';

const Dashboard = () => {
    const { students, classes, records } = useAppContext();

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
        { label: 'Ingreso Total (Mes)', value: `$${totalIncome.toLocaleString()}`, icon: Wallet, color: '#e74c3c' },
        { label: 'Alumnos Activos', value: students.length, icon: Users, color: '#3498db' },
        { label: 'Efectivo', value: `$${totalCash.toLocaleString()}`, icon: TrendingUp, color: '#2ecc71' },
        { label: 'Transferencias', value: `$${totalTransfer.toLocaleString()}`, icon: TrendingUp, color: '#f1c40f' }
    ];

    return (
        <div className="dashboard">
            <header style={{ marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem' }}>¡Hola, Ventarrón! 🌪️</h2>
                <p style={{ margin: '5px 0 0', opacity: 0.5 }}>Aquí tienes un resumen de lo que va del mes.</p>
            </header>

            <div className="grid-stats" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px'
            }}>
                {stats.map((stat, idx) => (
                    <div key={idx} className="card shadow-md flex align-center gap-20" style={{ marginBottom: 0, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                            backgroundColor: `${stat.color}15`,
                            color: stat.color,
                            padding: '15px',
                            borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '12px', color: '#bdc3c7', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{stat.value}</h2>
                        </div>
                        <ArrowUpRight size={14} style={{ position: 'absolute', top: '15px', right: '15px', opacity: 0.2 }} />
                    </div>
                ))}
            </div>

            <div className="grid-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '30px' }}>
                <section>
                    <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Calendar size={20} color="#e74c3c" /> Clases de Hoy ({todayName})
                        </h3>
                    </div>
                    {todayClasses.length > 0 ? (
                        <div className="flex flex-column gap-15">
                            {todayClasses.map(cls => (
                                <div key={cls.id} className="card glass-card shadow-sm" style={{ padding: '20px', borderLeft: '4px solid #3498db' }}>
                                    <div className="flex justify-between align-center">
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{cls.name}</h4>
                                            <div className="flex gap-15 mt-10" style={{ opacity: 0.6, fontSize: '13px' }}>
                                                <span className="flex align-center gap-5"><Clock size={14} /> {cls.time} - {cls.endTime}</span>
                                                <span className="flex align-center gap-5"><MapPin size={14} /> Sede Principal</span>
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" style={{ padding: '8px 15px', fontSize: '12px' }}>Ver Lista</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                            No hay clases programadas para hoy. ¡Disfruta el descanso!
                        </div>
                    )}
                </section>

                <section>
                    <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TrendingUp size={20} color="#2ecc71" /> Últimos Pagos
                        </h3>
                    </div>
                    <div className="card shadow-sm" style={{ padding: '10px 0' }}>
                        {currentMonthRecords.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {currentMonthRecords.slice(-6).reverse().map((r, i) => {
                                    const student = students.find(s => s.id === r.studentId);
                                    const cls = classes.find(c => c.id === r.classId);
                                    return (
                                        <div key={i} className="flex justify-between align-center" style={{
                                            padding: '12px 20px',
                                            borderBottom: i === 5 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                            background: r.paymentAmount > 0 ? (r.paymentMethod === 'transfer' ? 'rgba(52, 152, 219, 0.03)' : 'rgba(46, 204, 113, 0.02)') : 'transparent'
                                        }}>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{student?.name || 'Invitado'}</p>
                                                <p style={{ margin: 0, fontSize: '11px', opacity: 0.5 }}>{cls?.name} • {r.date}</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, fontWeight: 700, color: r.paymentAmount > 0 ? (r.paymentMethod === 'transfer' ? '#3498db' : '#2ecc71') : 'rgba(255,255,255,0.2)', fontSize: '15px' }}>
                                                    {r.paymentAmount > 0 ? `+$${r.paymentAmount}` : '$0'}
                                                </p>
                                                {(r.paymentMethod === 'cash' || r.paymentMethod === 'transfer') && (
                                                    <span style={{ 
                                                        display: 'inline-block', 
                                                        marginTop: '4px',
                                                        padding: '2px 6px', 
                                                        borderRadius: '4px', 
                                                        fontSize: '9px', 
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
                            <div style={{ padding: '30px', textAlign: 'center', opacity: 0.4, fontSize: '14px' }}>
                                No hay movimientos este mes.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
