import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Calendar, Wallet, CreditCard, Mail, CheckCircle, Clock } from 'lucide-react';

const Payments = () => {
    const { records, students, classes } = useAppContext();
    const [monthFilter, setMonthFilter] = useState(''); // Empty means last 2 months
    const [searchTerm, setSearchTerm] = useState('');

    // Gereramos lista de meses disponibles para el filtro
    const availableMonths = [...new Set(records.map(r => r.date.substring(0, 7)))].sort((a, b) => b.localeCompare(a));

    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    const filteredRecords = records
        .filter(r => {
            const amount = Number(r.paymentAmount);
            if (amount <= 0) return false;
            
            // Filtro por Mes
            let matchesMonth = false;
            if (monthFilter) {
                matchesMonth = r.date.startsWith(monthFilter);
            } else {
                matchesMonth = r.date.startsWith(currentMonth) || r.date.startsWith(lastMonth);
            }
            if (!matchesMonth) return false;

            // Filtro por Alumno
            if (searchTerm) {
                const student = students.find(s => s.id === r.studentId);
                return student?.name.toLowerCase().includes(searchTerm.toLowerCase());
            }

            return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="payments-page">
            <div className="flex justify-between align-center" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                {/* BUSCADOR DE ALUMNO */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, flex: '1 1 300px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Search size={20} opacity={0.5} />
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', marginBottom: '5px' }}>Buscar por Alumno</label>
                        <input 
                            type="text"
                            placeholder="Ej: Juan Pérez..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ marginBottom: 0, background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '5px 0' }}
                        />
                    </div>
                </div>

                {/* FILTRO DE MES */}
                <div className="card" style={{ padding: '20px', marginBottom: 0, flex: '1 1 300px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Calendar size={20} opacity={0.5} />
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', marginBottom: '5px' }}>Ver Período</label>
                        <select 
                            value={monthFilter} 
                            onChange={(e) => setMonthFilter(e.target.value)}
                            style={{ marginBottom: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <option value="">Últimos 2 meses</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    {new Date(m + '-02T12:00:00').toLocaleDateString('es-UY', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '600px' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <tr>
                                <th style={{ padding: '15px' }}>Fecha</th>
                                <th>Alumno</th>
                                <th>Clase</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Método</th>
                                <th style={{ textAlign: 'center' }}>Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((r, idx) => {
                                const student = students.find(s => s.id === r.studentId) || { name: 'Alumno eliminado' };
                                const cls = classes.find(c => c.id === r.classId) || { name: 'Clase eliminada' };
                                const amount = Number(r.paymentAmount);
                                
                                let concept = "Clase Suelta";
                                if (amount === Number(cls.monthlyPrice)) concept = "Mensual 1xS";
                                else if (amount === Number(cls.monthly2xsPrice)) concept = "Mensual 2xS";

                                return (
                                    <tr key={`${r.studentId}-${r.date}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 15px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {new Date(r.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                                        <td style={{ fontSize: '12px', opacity: 0.7 }}>{cls.name}</td>
                                        <td>
                                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '10px', opacity: 0.6 }}>
                                                {concept}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: '#2ecc71' }}>${amount}</td>
                                        <td>
                                            <div className="flex align-center gap-5" style={{ fontSize: '11px', opacity: 0.8 }}>
                                                {r.paymentMethod === 'transfer' ? <CreditCard size={14} color="#3498db" /> : <Wallet size={14} color="#2ecc71" />}
                                                {r.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.receiptSent ? (
                                                <div className="flex align-center justify-center gap-5" style={{ color: '#2ecc71', fontSize: '11px' }}>
                                                    <CheckCircle size={16} /> 
                                                </div>
                                            ) : (
                                                <Clock size={16} opacity={0.2} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRecords.length === 0 && (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>
                                        {searchTerm ? `No hay registros de pago para "${searchTerm}".` : 'No se registran pagos en este período.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Payments;
