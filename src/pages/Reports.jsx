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
    Users,
    Mail,
    Send,
    Eye,
    CheckCircle2,
    Loader2,
    Download
} from 'lucide-react';

const Reports = () => {
    const { students, classes, records, triggerTestReminder, getPendingReminders, triggerManualReminders } = useAppContext();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [pendingReminders, setPendingReminders] = useState(null);
    const [isLoadingPending, setIsLoadingPending] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [expandedDebtor, setExpandedDebtor] = useState(null);
    const [debtTypeFilter, setDebtTypeFilter] = useState('all'); // 'all', 'classes', 'practices'


    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
    const yearMonth = `${selectedYear}-${monthStr}`;

    const currentMonthRecords = records.filter(r => r.date && r.date.startsWith(yearMonth));

    // Identificar niveles de montos que corresponden a mensualidades
    const monthlyPriceLevels = new Set();
    classes.forEach(c => {
        if (c.monthlyPrice) monthlyPriceLevels.add(Number(c.monthlyPrice));
        if (c.monthly2xsPrice) monthlyPriceLevels.add(Number(c.monthly2xsPrice));
    });

    const classIncomeMap = {};
    classes.forEach(c => {
        classIncomeMap[c.id] = { total: 0, cash: 0, transfer: 0 };
    });

    currentMonthRecords.forEach(r => {
        const amount = parseFloat(r.paymentAmount) || 0;
        if (amount <= 0) return;

        const isMonthly = monthlyPriceLevels.has(amount);
        const student = students.find(s => s.id === r.studentId);
        const enrolled = student?.enrolledClasses || [];

        if (isMonthly && enrolled.length > 0) {
            const share = amount / enrolled.length;
            enrolled.forEach(cid => {
                if (classIncomeMap[cid]) {
                    classIncomeMap[cid].total += share;
                    if (r.paymentMethod === 'cash') classIncomeMap[cid].cash += share;
                    else if (r.paymentMethod === 'transfer') classIncomeMap[cid].transfer += share;
                }
            });
        } else {
            if (classIncomeMap[r.classId]) {
                classIncomeMap[r.classId].total += amount;
                if (r.paymentMethod === 'cash') classIncomeMap[r.classId].cash += amount;
                else if (r.paymentMethod === 'transfer') classIncomeMap[r.classId].transfer += amount;
            }
        }
    });

    // Calculate stats by Class
    const classBreakdown = classes.map(cls => {
        let classRecords = currentMonthRecords.filter(r => r.classId === cls.id);
        
        const dayOfWeekMap = {
            'Sunday': 'Domingo', 'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
            'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado'
        };

        // Filtramos estrictamente para que solo cuenten registros que coincidan con el día programado de la clase
        classRecords = classRecords.filter(r => {
            if (r.studentId === 'NO_CLASS') return true; 
            const dObj = new Date(r.date + 'T12:00:00');
            const dNameEn = dObj.toLocaleDateString('en-US', { weekday: 'long' });
            return cls.isPractice || dayOfWeekMap[dNameEn] === cls.day;
        });

        const incomeFromMap = classIncomeMap[cls.id] || { total: 0, cash: 0, transfer: 0 };
        const totalIncome = incomeFromMap.total;
        const cashIncome = incomeFromMap.cash;
        const transferIncome = incomeFromMap.transfer;

        // Attendance stats
        const totalAttendances = classRecords.filter(r => r.present).length;
        const guestAttendances = classRecords.filter(r => r.present && r.isGuest).length;
        const recoveryAttendances = classRecords.filter(r => r.present && r.isRecovery).length;
        const plAttendances = classRecords.filter(r => r.present && r.isPL).length;
        
        const datesWithNoClass = new Set(classRecords.filter(r => r.studentId === 'NO_CLASS').map(r => r.date));
        const sessionDates = [...new Set(classRecords.filter(r => r.studentId !== 'NO_CLASS' && !datesWithNoClass.has(r.date)).map(r => r.date))].sort();
        const sessionsHeld = sessionDates.length;

        const totalRent = cls.isPractice 
            ? (sessionsHeld > 0 ? (cls.rent || 0) : 0) // Para prácticas el alquiler es por evento único
            : (sessionsHeld * (cls.rent || 0)); // Para clases regulares es por sesión
        const profitBeforeSplit = totalIncome - totalRent;
        const userProfit = profitBeforeSplit * (cls.profitSplit || 1);

        return {
            ...cls,
            sessionsHeld,
            sessionDates,
            totalIncome,
            cashIncome,
            transferIncome,
            totalRent,
            profitBeforeSplit,
            userProfit,
            totalAttendances,
            guestAttendances,
            recoveryAttendances,
            plAttendances
        };
    });

    const totalMonthlyIncome = classBreakdown.reduce((acc, c) => acc + c.totalIncome, 0);
    const totalMonthlyCash = classBreakdown.reduce((acc, c) => acc + c.cashIncome, 0);
    const totalMonthlyTransfer = classBreakdown.reduce((acc, c) => acc + c.transferIncome, 0);
    const totalMonthlyRent = classBreakdown.reduce((acc, c) => acc + c.totalRent, 0);
    const totalUserProfit = classBreakdown.reduce((acc, c) => acc + c.userProfit, 0);
    const totalAttendancesMonth = classBreakdown.reduce((acc, c) => acc + c.totalAttendances, 0);

    const exportToCSV = () => {
        const headers = ["Clase", "Dia/Hora", "Sesiones", "Ingreso Total", "Efectivo", "Transferencia", "Alquiler", "Ganancia Total", "División", "Ganancia Final"];
        const rows = classBreakdown.map(c => [
            c.name,
            `${c.day} ${c.time}`,
            c.sessionsHeld,
            c.totalIncome,
            c.cashIncome,
            c.transferIncome,
            c.totalRent,
            c.profitBeforeSplit,
            c.profitSplit === 1 ? "100%" : "50/50",
            c.userProfit
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Balance_Ventarron_${months[selectedMonth]}_${selectedYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportClassDetail = (clsId) => {
        const cls = classes.find(c => c.id === clsId);
        if (!cls) return;

        let classRecords = currentMonthRecords.filter(r => r.classId === clsId);
        
        const dayOfWeekMap = {
            'Sunday': 'Domingo', 'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
            'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado'
        };

        // Filtramos estrictamente para que solo cuenten registros que coincidan con el día programado de la clase
        classRecords = classRecords.filter(r => {
            if (r.studentId === 'NO_CLASS') return true; 
            const dObj = new Date(r.date + 'T12:00:00');
            const dNameEn = dObj.toLocaleDateString('en-US', { weekday: 'long' });
            return cls.isPractice || dayOfWeekMap[dNameEn] === cls.day;
        });

        const datesWithNoClass = new Set(classRecords.filter(r => r.studentId === 'NO_CLASS').map(r => r.date));
        const classDates = [...new Set(classRecords.filter(r => r.studentId !== 'NO_CLASS' && !datesWithNoClass.has(r.date)).map(r => r.date))].sort();
        
        // Estudiantes que tienen al menos un registro este mes para esta clase
        const relevantStudentIds = [...new Set(classRecords.filter(r => r.studentId !== 'NO_CLASS').map(r => r.studentId))];
        const relevantStudents = relevantStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));

        const headers = ["Alumno", ...classDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })), "Pagado en este grupo", "TOTAL ASIGNADO"];
        
        const rows = relevantStudents.map(student => {
            let studentLocalTotal = 0;
            const columns = classDates.map(date => {
                const rec = classRecords.find(r => r.studentId === student.id && r.date === date);
                if (!rec) return "-";
                
                const amount = parseFloat(rec.paymentAmount) || 0;
                studentLocalTotal += amount;
                
                let mark = "A";
                if (rec.isGuest) mark = "INV";
                else if (rec.isRecovery || !(student.enrolledClasses || []).includes(clsId)) mark = "R";
                
                let cell = rec.present ? `[${mark}]` : "[-] ";
                if (amount > 0) cell += ` $${amount}`;
                return cell;
            });

            // Calcular cuánto de las mensualidades del alumno corresponden a ESTA clase
            const studentAllRecords = currentMonthRecords.filter(r => r.studentId === student.id);
            let totalAssignedToThisClass = 0;

            studentAllRecords.forEach(r => {
                const amount = parseFloat(r.paymentAmount) || 0;
                if (amount <= 0) return;

                const isMonthly = monthlyPriceLevels.has(amount);
                const enrolled = student?.enrolledClasses || [];

                if (isMonthly && enrolled.length > 0) {
                    if (enrolled.includes(clsId)) {
                        totalAssignedToThisClass += amount / enrolled.length;
                    }
                } else if (r.classId === clsId) {
                    // Pago individual en esta clase
                    totalAssignedToThisClass += amount;
                }
            });

            return [student.name, ...columns, `$${studentLocalTotal}`, `$${Math.round(totalAssignedToThisClass)}` + (studentLocalTotal !== totalAssignedToThisClass ? " (*)" : "")];
        });

        // Cálculos de resumen financiero para esta clase
        const clsSummary = classBreakdown.find(c => c.id === clsId);
        const totalIncomeLabel = `Total Ingresos Asignados (Prorrateo):,$${clsSummary.totalIncome}`;
        const totalRentLabel = `Alquiler (${clsSummary.sessionsHeld} días):,$${clsSummary.totalRent}`;
        const profitToSplitLabel = `Ganancia a repartir:,$${clsSummary.profitBeforeSplit}`;
        
        let profitSplitRows = [];
        if (clsSummary.profitSplit === 1) {
            profitSplitRows.push(`Ganancia Profesor (100%):,$${clsSummary.userProfit}`);
        } else {
            const partnerProfit = clsSummary.profitBeforeSplit * (1 - clsSummary.profitSplit);
            profitSplitRows.push(`Ganancia Profesor 1:,$${clsSummary.userProfit}`);
            profitSplitRows.push(`Ganancia Profesor 2:,$${partnerProfit}`);
        }

        const csvContent = [
            [`Detalle de Asistencia y Pagos - ${cls.name}`, `${months[selectedMonth]} ${selectedYear}`].join(","),
            [`Ingreso Total (Redistribuido): $${clsSummary.totalIncome}`, `(*) El monto asignado considera el reparto de pases libres y mensualidades entre grupos.`].join(","),
            [],
            headers.join(","),
            ...rows.map(row => row.join(",")),
            [], // Espacio
            ["RESUMEN FINANCIERO"],
            [totalIncomeLabel],
            [totalRentLabel],
            [profitToSplitLabel],
            ...profitSplitRows.map(row => [row])
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Detalle_${cls.name.replace(/\s+/g, '_')}_${months[selectedMonth]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="reports-page" style={{ padding: '0 5px' }}>
            <header className="card flex justify-between align-center responsive-header" style={{ marginBottom: '25px', padding: '20px' }}>
                <div className="flex align-center gap-15 flex-wrap date-selectors">
                    <Calendar size={22} color="#3498db" />
                    <div className="flex gap-10">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            style={{ width: '130px', marginBottom: 0 }}
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            style={{ width: '100px', marginBottom: 0 }}
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-15 header-actions">
                    <div className="month-title">
                        <p style={{ margin: 0, fontSize: '11px', opacity: 0.5, letterSpacing: '1px', textAlign: 'right' }}>RESUMEN MENSUAL</p>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'right' }}>{months[selectedMonth]} {selectedYear}</h3>
                    </div>
                    <button className="btn btn-secondary" onClick={exportToCSV} style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                        <Download size={18} /> EXPORTAR BALANCE
                    </button>
                </div>
            </header>

            <div className="grid-summary" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px'
            }}>
                <div className="card shadow-sm" style={{ borderTop: '4px solid #3498db', marginBottom: 0 }}>
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

                <div className="card shadow-sm" style={{ borderTop: '4px solid #e74c3c', marginBottom: 0 }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>ALQUILER TOTAL</span>
                        <Building2 size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0 }}>${totalMonthlyRent.toLocaleString()}</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.5 }}>Deducido de la ganancia final.</p>
                </div>

                <div className="card shadow-sm" style={{ borderTop: '4px solid #2ecc71', background: 'rgba(46, 204, 113, 0.05)', marginBottom: 0 }}>
                    <div className="flex justify-between align-center" style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', opacity: 0.6 }}>TU GANANCIA</span>
                        <DollarSign size={18} opacity={0.3} />
                    </div>
                    <h2 style={{ margin: 0, color: '#2ecc71' }}>${totalUserProfit.toLocaleString()}</h2>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.5 }}>Monto neto tras descontar alquiler y socios.</p>
                </div>

                <div className="card shadow-sm" style={{ borderTop: '4px solid #f1c40f', marginBottom: 0 }}>
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
                    <table style={{ minWidth: '100% ' }}>
                        <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <tr>
                                <th style={{ padding: '15px' }}>Clase</th>
                                <th>Asistencias</th>
                                <th>Ingresos</th>
                                 <th style={{ textAlign: 'center' }}>Alquiler</th>
                                <th style={{ textAlign: 'center' }}>División</th>
                                <th style={{ textAlign: 'right' }}>Ganancia</th>
                                <th style={{ textAlign: 'center', paddingRight: '15px', width: '60px' }}>Planilla</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classBreakdown
                                .filter(cls => cls.sessionsHeld > 0 || !cls.isPractice) // Mostrar si hubo actividad o si es un grupo regular
                                .map(cls => (
                                <tr key={cls.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: 600 }} spellCheck="false" autoCorrect="off" autoCapitalize="none">{cls.name}</div>
                                        <div style={{ fontSize: '12px', opacity: 0.5 }}>{cls.day} {cls.time}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <div style={{ fontSize: '12px' }}>{cls.totalAttendances} asistentes</div>
                                            <div style={{ fontSize: '9px', opacity: 0.5 }}>({cls.guestAttendances} Inv / {cls.recoveryAttendances} Rec / {cls.plAttendances} PL)</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>${cls.totalIncome.toLocaleString()}</div>
                                        <div style={{ fontSize: '9px', opacity: 0.5 }}>
                                            Efe: ${cls.cashIncome.toLocaleString()} | Trf: ${cls.transferIncome.toLocaleString()}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        ${cls.totalRent.toLocaleString()}<br/>
                                        <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px' }}>
                                            <strong>({cls.sessionsHeld} días)</strong><br/>
                                            {cls.sessionDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit' })).join(', ')}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', fontSize: '12px' }}>
                                        {cls.profitSplit === 1 ? '100%' : '50% (Colega)'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2ecc71' }}>
                                        ${cls.userProfit.toLocaleString()}
                                    </td>
                                    <td style={{ textAlign: 'center', paddingRight: '15px' }}>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={() => exportClassDetail(cls.id)} 
                                            style={{ padding: '8px', background: 'rgba(52, 152, 219, 0.1)', border: '1px solid rgba(52, 152, 219, 0.2)', color: '#3498db' }}
                                            title="Descargar planilla detallada"
                                        >
                                            <Download size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Herramientas de Administración */}
            <div className="card" style={{ marginTop: '30px', border: '1px solid rgba(52, 152, 219, 0.3)', background: 'rgba(52, 152, 219, 0.05)', padding: '20px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#3498db', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Send size={20} /> Recordatorios de Mensualidad
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                    {/* Columna Izquierda: Acciones */}
                    <div>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.8, lineHeight: '1.5' }}>
                            Desde aquí puedes controlar el envío de los recordatorios que normalmente se envían el día 7 de cada mes.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={async () => {
                                    setIsLoadingPending(true);
                                    try {
                                        const res = await getPendingReminders({ monthPrefix: yearMonth });
                                        if (res.data.success) {
                                            setPendingReminders(res.data.students);
                                        } else {
                                            alert("Error al cargar lista: " + res.data.message);
                                        }
                                    } catch (e) {
                                        alert("Error de conexión.");
                                    } finally {
                                        setIsLoadingPending(false);
                                    }
                                }}
                                disabled={isLoadingPending}
                                className="btn btn-secondary"
                                style={{ justifyContent: 'center', padding: '12px', fontWeight: '600' }}
                            >
                                {isLoadingPending ? <Loader2 size={18} className="spin" /> : <Eye size={18} />}
                                VER ALUMNOS CON COBRO PENDIENTE
                            </button>

                            {pendingReminders && pendingReminders.length > 0 && (
                                <button 
                                    onClick={async () => {
                                        if (window.confirm(`¿Estás seguro de enviar recordatorios REALES a los ${pendingReminders.length} alumnos de la lista?`)) {
                                            setIsSending(true);
                                            try {
                                                const res = await triggerManualReminders({ monthPrefix: yearMonth });
                                                if (res.data.success) {
                                                    alert(`¡Proceso completado! Se enviaron ${res.data.count} recordatorios.`);
                                                    setPendingReminders(null);
                                                } else {
                                                    alert("Error en el envío: " + res.data.message);
                                                }
                                            } catch (e) {
                                                alert("Error durante el envío masivo.");
                                            } finally {
                                                setIsSending(false);
                                            }
                                        }
                                    }}
                                    disabled={isSending}
                                    className="btn"
                                    style={{ 
                                        backgroundColor: '#e74c3c', color: 'white', border: 'none', 
                                        justifyContent: 'center', padding: '14px', fontWeight: 'bold' 
                                    }}
                                >
                                    {isSending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                                    ENVIAR RECORDATORIOS AHORA
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Columna Derecha: Lista Previsualizada */}
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '20px', minHeight: '150px' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '13px', opacity: 0.5, textTransform: 'uppercase' }}>
                            Alumnos Deudores (Filtro: Inscritos + Han Asistido)
                        </h4>
                        
                        {pendingReminders === null ? (
                            <p style={{ fontSize: '13px', opacity: 0.4, textAlign: 'center', marginTop: '40px' }}>
                                Haz clic en "Ver alumnos" para cargar la lista.
                            </p>
                        ) : pendingReminders.length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '30px' }}>
                                <CheckCircle2 size={40} color="#2ecc71" style={{ marginBottom: '10px', opacity: 0.5 }} />
                                <p style={{ fontSize: '14px', color: '#2ecc71' }}>¡Todos los alumnos tienen sus pagos al día!</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-10" style={{ marginBottom: '15px' }}>
                                    <button 
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('all')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'all' ? '#3498db' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'all' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', fontWeight: 'bold'
                                        }}
                                    >TODOS</button>
                                    <button 
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('classes')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'classes' ? '#3498db' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'classes' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', fontWeight: 'bold'
                                        }}
                                    >DEUDAS CLASES</button>
                                    <button 
                                        className="btn" 
                                        onClick={() => setDebtTypeFilter('practices')}
                                        style={{ 
                                            flex: 1, fontSize: '10px', padding: '8px', 
                                            backgroundColor: debtTypeFilter === 'practices' ? '#f1c40f' : 'rgba(255,255,255,0.05)',
                                            border: debtTypeFilter === 'practices' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            color: 'white', fontWeight: 'bold'
                                        }}
                                    >DEUDAS PRÁCTICAS</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
                                    {pendingReminders
                                        .filter(s => {
                                            if (debtTypeFilter === 'classes') return s.classDebt > 0;
                                            if (debtTypeFilter === 'practices') return s.practiceDebt > 0;
                                            return true;
                                        })
                                        .map(s => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => setExpandedDebtor(expandedDebtor === s.id ? null : s.id)}
                                            className="flex flex-column" 
                                            style={{ 
                                                padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', 
                                                fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                                                border: expandedDebtor === s.id ? '1px solid rgba(52, 152, 219, 0.4)' : '1px solid transparent'
                                            }}
                                        >
                                            <div className="flex justify-between align-center">
                                                <span style={{ fontWeight: '600', color: expandedDebtor === s.id ? '#3498db' : 'inherit' }} spellCheck="false" autoCorrect="off" autoCapitalize="none">{s.name}</span>
                                                <span style={{ fontSize: '11px', opacity: 0.5 }}>{s.email}</span>
                                            </div>
                                            <div className="flex justify-between align-center" style={{ marginTop: '5px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#e74c3c' }}>${s.totalOwed}</span>
                                                <div className="flex gap-5">
                                                    {s.classDebt > 0 && <span style={{ fontSize: '9px', backgroundColor: 'rgba(52, 152, 219, 0.1)', color: '#3498db', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', border: '1px solid rgba(52, 152, 219, 0.2)' }}>CLASES: ${s.classDebt}</span>}
                                                    {s.practiceDebt > 0 && <span style={{ fontSize: '9px', backgroundColor: 'rgba(241, 196, 15, 0.1)', color: '#f1c40f', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', border: '1px solid rgba(241, 196, 15, 0.2)' }}>PRÁCTICAS: ${s.practiceDebt}</span>}
                                                </div>
                                            </div>
                                            
                                            {expandedDebtor === s.id && (s.attendanceDetails || s.attendanceDates) && (
                                                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <p style={{ margin: 0, fontSize: '10px', opacity: 0.6, color: '#3498db', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        Asistencias sin pago (este mes):
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {s.attendanceDetails ? (
                                                            s.attendanceDetails.map(det => (
                                                                <div key={det.date + det.className} style={{ 
                                                                    backgroundColor: det.isPractice ? 'rgba(241, 196, 15, 0.15)' : 'rgba(52, 152, 219, 0.15)', 
                                                                    color: det.isPractice ? '#f1c40f' : '#3498db', 
                                                                    padding: '5px 10px', borderRadius: '6px', fontSize: '11px', 
                                                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                                    border: `1px solid ${det.isPractice ? 'rgba(241, 196, 15, 0.2)' : 'rgba(52, 152, 219, 0.2)'}`
                                                                }}>
                                                                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{new Date(det.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}</span>
                                                                    <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', fontWeight: '600', marginTop: '2px' }}>{det.className}</span>
                                                                </div>
                                                            ))
                                                        ) : s.attendanceDates.length > 0 ? (
                                                            s.attendanceDates.map(date => (
                                                                <span key={date} style={{ backgroundColor: 'rgba(52, 152, 219, 0.15)', color: '#3498db', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                                                    {new Date(date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ fontSize: '11px', opacity: 0.5 }}>No se encontraron asistencias registradas.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>


    );
};

export default Reports;
