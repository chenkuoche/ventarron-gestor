import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, Wallet, Calendar, TrendingUp, Clock, BarChart3, ArrowRightLeft } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Cell, ComposedChart, Line
} from 'recharts';

const Dashboard = () => {
    const { students, classes, records, setActivePage, setSelectedClassId, setSelectedDate } = useAppContext();

    const handleViewList = (cls) => {
        if ((cls.isPractice || cls.date) && cls.date) {
            setSelectedDate(cls.date);
        }
        setSelectedClassId(cls.id);
        setActivePage('Asistencia y Pagos');
    };

    // --- LÓGICA DE DATOS ---
    const today = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const todayName = dayNames[today.getDay()];
    const currentYear = today.getFullYear();

    // 1. Datos para Gráfico Mensual (Enero a Diciembre)
    const annualData = useMemo(() => {
        return monthNames.map((month, index) => {
            const monthRecords = records.filter(r => {
                const d = new Date(r.date + 'T12:00:00');
                return d.getMonth() === index && d.getFullYear() === currentYear;
            });

            // Solo contamos asistencias de clases REGULARES (no prácticas)
            const regularAttendances = monthRecords.filter(r => {
                const cls = classes.find(c => c.id === r.classId);
                return r.present && cls && !cls.isPractice;
            }).length;
            
            return {
                name: month,
                ingresos: monthRecords.reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0),
                asistencias: regularAttendances
            };
        });
    }, [records, currentYear, classes]);

    // 2. Datos para Comparativa Semanal (Esta semana vs Pasada)
    const weeklyComparison = useMemo(() => {
        const getMonday = (d) => {
            const date = new Date(d);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const mon = new Date(date.setDate(diff));
            mon.setHours(0,0,0,0);
            return mon;
        };

        const thisMonday = getMonday(today);
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(lastMonday.getDate() - 7);

        return classes
            .filter(cls => !cls.isPractice) // También filtramos aquí para ver solo grupos fijos
            .map(cls => {
                const thisWeekCount = records.filter(r => {
                    const d = new Date(r.date + 'T12:00:00');
                    return r.classId === cls.id && r.present && d >= thisMonday;
                }).length;

                const lastWeekCount = records.filter(r => {
                    const d = new Date(r.date + 'T12:00:00');
                    return r.classId === cls.id && r.present && d >= lastMonday && d < thisMonday;
                }).length;

                // Nombre corto con Día y Hora (ej: Ma 19:30)
                const shortDay = cls.day.substring(0, 2);
                const label = `${shortDay} ${cls.time}`;

                return {
                    name: label,
                    actual: thisWeekCount,
                    pasada: lastWeekCount
                };
            }).filter(item => item.actual > 0 || item.pasada > 0);
    }, [records, classes]);

    // --- RENDER ---
    const currentMonthRecords = records.filter(r => {
        // Corregimos Date para el mes actual
        const recordDate = new Date(r.date + 'T12:00:00');
        return recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === currentYear;
    });

    const totalIncome = currentMonthRecords.reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);
    // Para identificar hoy en formato YYYY-MM-DD local
    const todayStr = today.getFullYear() + '-' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(today.getDate()).padStart(2, '0');

    const todayClasses = classes.filter(c => {
        // Consideramos práctica si tiene el flag o si tiene fecha específica guardada que no sea de creación
        // Para ser seguros, si tiene el flag isPractice, solo mostramos si es hoy
        if (c.isPractice === true || c.isPractice === 'true') {
            return c.date === todayStr;
        }
        
        // Anti-bug radical: si el nombre contiene palabras de evento único y la fecha NO es hoy,
        // lo ocultamos del dashboard principal para evitar ruido de eventos pasados.
        const nameLower = c.name.toLowerCase();
        const isOldEventByContent = c.date && c.date !== todayStr && 
            (nameLower.includes('cumpartida') || nameLower.includes('prueba') || nameLower.includes('abril'));
        
        if (isOldEventByContent) return false;

        // Si no es un evento detectado, usamos la lógica de día recurrente
        return c.day === todayName;
    });

    const stats = [
        { label: 'Ingresos (Mes)', value: `$${totalIncome.toLocaleString()}`, icon: Wallet, color: '#e74c3c' },
        { label: 'Base Alumnos', value: students.length, icon: Users, color: '#3498db' },
        { label: 'Asist. Regulares', value: currentMonthRecords.filter(r => {
            const cls = classes.find(c => c.id === r.classId);
            return r.present && cls && !cls.isPractice;
        }).length, icon: TrendingUp, color: '#2ecc71' },
    ];

    return (
        <div className="dashboard" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
            <header style={{ marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem' }}>¡Hola, Ventarrón! 🌪️</h2>
                <p style={{ margin: '5px 0 0', opacity: 0.5, fontSize: '14px' }}>Dashboard de Clases Regulares {currentYear}</p>
            </header>

            {/* STATS RÁPIDAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                {stats.map((stat, idx) => (
                    <div key={idx} className="card shadow-md flex align-center gap-15" style={{ marginBottom: 0, padding: '20px' }}>
                        <div style={{ backgroundColor: `${stat.color}15`, color: stat.color, padding: '12px', borderRadius: '12px' }}>
                            <stat.icon size={22} />
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', color: '#bdc3c7', margin: 0, textTransform: 'uppercase' }}>{stat.label}</p>
                            <h3 style={{ margin: 0, fontSize: '20px' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* GRÁFICOS PRINCIPALES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {/* Gráfico Mensual */}
                <div className="card shadow-sm" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <BarChart3 size={18} color="#3498db" /> Ingresos vs Asistencias Regulares
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <ComposedChart data={annualData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#bdc3c7', fontSize: 10}} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#3498db', fontSize: 10}} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#e74c3c', fontSize: 10}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#2c3e50', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px' }}
                                    itemStyle={{ color: 'white' }}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                />
                                <Bar yAxisId="left" dataKey="ingresos" fill="#3498db" radius={[4, 4, 0, 0]} barSize={15} />
                                <Bar yAxisId="right" dataKey="asistencias" fill="#e74c3c" radius={[4, 4, 0, 0]} barSize={15} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', opacity: 0.6 }}>
                            <div style={{ width: '8px', height: '8px', backgroundColor: '#3498db', borderRadius: '2px' }}></div> Ingresos ($)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', opacity: 0.6 }}>
                            <div style={{ width: '8px', height: '8px', backgroundColor: '#e74c3c', borderRadius: '2px' }}></div> Asistencias (Cant.)
                        </div>
                    </div>
                </div>

                {/* Comparativa Semanal */}
                <div className="card shadow-sm" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ArrowRightLeft size={18} color="#2ecc71" /> Asistencia: Esta Semana vs Pasada
                    </h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={weeklyComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#bdc3c7', fontSize: 9}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#bdc3c7', fontSize: 10}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#2c3e50', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px' }}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                />
                                <Bar dataKey="pasada" fill="rgba(255,255,255,0.3)" radius={[3, 3, 0, 0]} barSize={12} />
                                <Bar dataKey="actual" fill="#2ecc71" radius={[3, 3, 0, 0]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9px', opacity: 0.8 }}>
                            <div style={{ width: '8px', height: '8px', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '2px' }}></div> Semana Pasada
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9px', opacity: 0.8 }}>
                            <div style={{ width: '8px', height: '8px', backgroundColor: '#2ecc71', borderRadius: '2px' }}></div> Esta Semana
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIONES OPERATIVAS */}
            <div className="grid-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <section>
                    <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                        <Calendar size={18} color="#e74c3c" /> Clases de Hoy ({todayName})
                    </h3>
                    {todayClasses.length > 0 ? (
                        <div className="flex flex-column gap-10">
                            {todayClasses.map(cls => (
                                <div key={cls.id} className="card shadow-sm" style={{ padding: '15px', borderLeft: '4px solid #3498db', marginBottom: 0 }}>
                                    <div className="flex justify-between align-center">
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1rem' }}>{cls.name}</h4>
                                            <p style={{ opacity: 0.6, fontSize: '11px', margin: '4px 0 0' }}><Clock size={10} /> {cls.time}hs</p>
                                        </div>
                                        <button onClick={() => handleViewList(cls)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Lista</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>No hay clases hoy.</div>
                    )}
                </section>

                <section>
                    <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                        <Wallet size={18} color="#2ecc71" /> Últimos Pagos
                    </h3>
                    <div className="card shadow-sm" style={{ padding: '0', marginBottom: 0, overflow: 'hidden' }}>
                        {[...records]
                            .filter(r => (parseFloat(r.paymentAmount) || 0) > 0)
                            .sort((a, b) => {
                                // 1. Prioridad: Fecha de la clase (descendente)
                                if (a.date !== b.date) return b.date.localeCompare(a.date);

                                // 2. Segunda prioridad: Hora de la clase (descendente)
                                const classA = classes.find(c => c.id === a.classId);
                                const classB = classes.find(c => c.id === b.classId);
                                const timeA = classA?.time || '00:00';
                                const timeB = classB?.time || '00:00';
                                if (timeA !== timeB) return timeB.localeCompare(timeA);

                                // 3. Tercera prioridad: Última actualización (descendente)
                                return (b.updatedAt || b.date).localeCompare(a.updatedAt || a.date);
                            })
                            .slice(0, 5)
                            .map((r, i) => {
                                const student = students.find(s => s.id === r.studentId);
                                const cls = classes.find(c => c.id === r.classId);
                                return (
                                    <div key={i} style={{ padding: '12px 15px', borderBottom: i === 4 ? 'none' : '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{student?.name || 'Invitado'}</p>
                                            <p style={{ margin: 0, fontSize: '9px', opacity: 0.4 }}>{cls?.name} • {r.date.split('-').reverse().join('/')}</p>
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#2ecc71' }}>
                                            +${r.paymentAmount}
                                        </span>
                                    </div>
                                );
                            })}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;

