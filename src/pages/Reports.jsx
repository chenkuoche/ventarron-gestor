import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import {
    PieChart,
    TrendingUp,
    Wallet,
    CreditCard,
    DollarSign,
    Calendar,
    Building2,
    Users
} from 'lucide-react';

const Reports = () => {
    const { students, classes, records } = useAppContext();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const currentMonthRecords = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
    });

    // Calculate stats by Class
    const classBreakdown = classes.map(cls => {
        const classRecords = currentMonthRecords.filter(r => r.classId === cls.id);
        const totalIncome = classRecords.reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);
        const cashIncome = classRecords
            .filter(r => r.paymentMethod === 'cash')
            .reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);
        const transferIncome = classRecords
            .filter(r => r.paymentMethod === 'transfer')
            .reduce((acc, r) => acc + (parseFloat(r.paymentAmount) || 0), 0);

        // Attendance stats
        const totalAttendances = classRecords.filter(r => r.present).length;
        const guestAttendances = classRecords.filter(r => r.present && r.isGuest).length;
        const sessionsHeld = [...new Set(classRecords.map(r => r.date))].length;

        const totalRent = sessionsHeld * (cls.rent || 0);
        const profitBeforeSplit = totalIncome - totalRent;
        const userProfit = profitBeforeSplit * (cls.profitSplit || 1);

        return {
            ...cls,
            sessionsHeld,
            totalIncome,
            cashIncome,
            transferIncome,
            totalRent,
            userProfit,
            totalAttendances,
            guestAttendances
        };
    });

    const totalMonthlyIncome = classBreakdown.reduce((acc, c) => acc + c.totalIncome, 0);
    const totalMonthlyCash = classBreakdown.reduce((acc, c) => acc + c.cashIncome, 0);
    const totalMonthlyTransfer = classBreakdown.reduce((acc, c) => acc + c.transferIncome, 0);
    const totalMonthlyRent = classBreakdown.reduce((acc, c) => acc + c.totalRent, 0);
    const totalUserProfit = classBreakdown.reduce((acc, c) => acc + c.userProfit, 0);
    const totalAttendancesMonth = classBreakdown.reduce((acc, c) => acc + c.totalAttendances, 0);

    return (
        <div className="reports-page">
            <header className="card flex justify-between align-center" style={{ marginBottom: '30px', padding: '15px 24px' }}>
                <div className="flex align-center gap-20">
                    <Calendar size={22} color="#3498db" />
                    <div className="flex gap-10">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            style={{ width: '150px', marginBottom: 0 }}
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            style={{ width: '120px', marginBottom: 0 }}
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.5 }}>RESUMEN MENSUAL</p>
                    <h3 style={{ margin: 0 }}>{months[selectedMonth]} {selectedYear}</h3>
                </div>
            </header>

            <div className="grid-summary" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px'
            }}>
                <div className="card shadow-sm" style={{ borderTop: '4px solid #3498db' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>INGRESOS BRUTOS</span>
                        <Wallet size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0 }}>${totalMonthlyIncome.toLocaleString()}</h2>
                    <div className="flex gap-15 mt-10" style={{ fontSize: '12px', opacity: 0.7 }}>
                        <span>Efe: ${totalMonthlyCash.toLocaleString()}</span>
                        <span>Trf: ${totalMonthlyTransfer.toLocaleString()}</span>
                    </div>
                </div>

                <div className="card shadow-sm" style={{ borderTop: '4px solid #e74c3c' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>ALQUILER TOTAL</span>
                        <Building2 size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0 }}>${totalMonthlyRent.toLocaleString()}</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.5 }}>Deducido de la ganancia final.</p>
                </div>

                <div className="card shadow-sm" style={{ borderTop: '4px solid #2ecc71', background: 'rgba(46, 204, 113, 0.05)' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>TU GANANCIA</span>
                        <DollarSign size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0, color: '#2ecc71' }}>${totalUserProfit.toLocaleString()}</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.5 }}>Fueran socios o alquiler.</p>
                </div>

                <div className="card shadow-sm" style={{ borderTop: '4px solid #f1c40f' }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>CONCURRENCIA</span>
                        <Users size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0 }}>{totalAttendancesMonth}</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.5 }}>Asistencias totales en el mes.</p>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '20px' }}>
                    <h3 style={{ margin: 0 }}>Detalle por Clase</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '100%' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <tr>
                                <th style={{ padding: '15px' }}>Clase</th>
                                <th>Asistencias</th>
                                <th>Ingresos</th>
                                <th>Alquiler</th>
                                <th>División</th>
                                <th style={{ textAlign: 'right', paddingRight: '20px' }}>Ganancia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classBreakdown.map(cls => (
                                <tr key={cls.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 600 }}>{cls.name}</div>
                                        <div style={{ fontSize: '12px', opacity: 0.5 }}>{cls.day} {cls.time}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '13px' }}>
                                            {cls.totalAttendances} totales<br />
                                            <span style={{ fontSize: '11px', opacity: 0.5 }}>{cls.guestAttendances} invitados</span>
                                        </div>
                                    </td>
                                    <td>${cls.totalIncome.toLocaleString()}</td>
                                    <td>${cls.totalRent.toLocaleString()}</td>
                                    <td style={{ fontSize: '12px' }}>
                                        {cls.profitSplit === 1 ? '100%' : '50% (Colega)'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2ecc71', paddingRight: '20px' }}>
                                        ${cls.userProfit.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;
