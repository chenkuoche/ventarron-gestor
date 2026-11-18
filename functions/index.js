const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

let dbInstance;
function getDb() {
    if (!dbInstance) {
        const { initializeApp } = require('firebase-admin/app');
        const { getFirestore } = require('firebase-admin/firestore');
        initializeApp();
        dbInstance = getFirestore();
    }
    return dbInstance;
}

let resendInstance;
function getResend() {
    if (!resendInstance) {
        const { Resend } = require("resend");
        resendInstance = new Resend(process.env.RESEND_API_KEY);
    }
    return resendInstance;
}

/**
 * Helper: Obtiene la lista de alumnos que deben mensualidad este mes
 * según los criterios: inscrito, ha asistido alguna vez y no ha pagado.
 */
async function getStudentsToRemind(db, targetMonthPrefix) {
    const now = new Date();
    const monthPrefix = targetMonthPrefix || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Obtener alumnos, clases y registros
    const [studentsSnap, classesSnap, paymentsSnap] = await Promise.all([
        db.collection('students').get(),
        db.collection('classes').get(),
        db.collection('attendance_records')
            .where('date', '>=', `${monthPrefix}-01`)
            .where('date', '<=', `${monthPrefix}-31`)
            .get()
    ]);

    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const classes = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allRecords = paymentsSnap.docs.map(d => d.data());

    // Mapeo detallado de clases
    const classDataMap = {};
    const monthlyPrices = new Set();
    classes.forEach(c => {
        classDataMap[c.id] = {
            name: c.name || 'Clase',
            classPrice: Number(c.classPrice || 0),
            monthlyPrice: Number(c.monthlyPrice || 0),
            monthly2xsPrice: Number(c.monthly2xsPrice || 0),
            isPractice: c.isPractice || false
        };
        if (c.monthlyPrice) monthlyPrices.add(Number(c.monthlyPrice));
        if (c.monthly2xsPrice) monthlyPrices.add(Number(c.monthly2xsPrice));
    });

    const results = [];

    // 2. Procesar cada alumno
    students.forEach(s => {
        if (!s.email) return;

        const studentRecords = allRecords.filter(r => r.studentId === s.id);
        const unpaidAttendances = studentRecords.filter(r => {
            const data = classDataMap[r.classId];
            if (!data) return false;
            
            // Requisitos básicos: presente y sin pago
            if (r.present !== true || Number(r.paymentAmount) > 0 || r.isPL) return false;

            // Filtro de Invitados: siempre gratis (pedidor por el usuario)
            if (r.isGuest) return false;

            // Filtro de Recuperaciones: gratis en clases regulares, pero visibles como deuda en prácticas
            if (r.isRecovery && !data.isPractice) return false;

            return true;
        });

        if (unpaidAttendances.length === 0) return;

        // Verificar si ya pagó una mensualidad este mes
        const hasPaidMonthly = studentRecords.some(r => r.isMonthlyCovered === true || monthlyPrices.has(Number(r.paymentAmount)));
        
        let classDebt = 0;
        let practiceDebt = 0;
        let attendanceDetails = [];

        unpaidAttendances.forEach(r => {
            const data = classDataMap[r.classId];
            if (!data) return;

            // Si ya pagó mensualidad, solo contamos las deudas de prácticas
            if (hasPaidMonthly && !data.isPractice) return;

            const amount = data.classPrice || 0;
            if (data.isPractice) {
                practiceDebt += amount;
            } else {
                classDebt += amount;
            }
            
            attendanceDetails.push({
                date: r.date,
                className: data.name,
                isPractice: data.isPractice,
                amount: amount
            });
        });

        if (attendanceDetails.length === 0) return;

        // Lógica de redondeo a mensualidad solo para la parte de "clases"
        let isFullMonthly = false;
        let finalClassDebt = classDebt;

        if (classDebt > 0 && s.enrolledClasses && s.enrolledClasses.length > 0) {
            const firstClass = s.enrolledClasses[0];
            const studentMonthlyPrice = s.enrolledClasses.length > 1
                ? classDataMap[firstClass]?.monthly2xsPrice
                : classDataMap[firstClass]?.monthlyPrice;

            if (studentMonthlyPrice && classDebt >= studentMonthlyPrice) {
                finalClassDebt = studentMonthlyPrice;
                isFullMonthly = true;
            }
        }

        const totalOwed = finalClassDebt + practiceDebt;

        if (attendanceDetails.length > 0) {
            results.push({
                id: s.id,
                name: s.name,
                email: s.email,
                attendanceDates: attendanceDetails.map(d => d.date).sort(), // Para retrocompatibilidad
                attendanceDetails: attendanceDetails.sort((a, b) => a.date.localeCompare(b.date)),
                totalOwed,
                classDebt: finalClassDebt,
                practiceDebt,
                isFullMonthly
            });
        }
    });

    return results;
}


/**
 * Función manual para enviar recibos desde la App
 */
exports.sendEmail = onCall({
    secrets: ["RESEND_API_KEY"],
    enforceAppCheck: false,
    region: "us-central1"
}, async (request) => {
    if (!request.auth) throw new Error("unauthenticated", "Sin permisos.");

    const { to, subject, html } = request.data;
    const resend = getResend();

    try {
        const { data, error } = await resend.emails.send({
            from: "Ventarrón Escuela de Tango <info@escueladetangoventarron.com>",
            to: [to],
            reply_to: "escueladetangoventarron@gmail.com",
            subject: subject,
            html: html,
        });

        if (error) return { success: false, error };
        return { success: true, id: data.id };
    } catch (err) {
        logger.error("Error en sendEmail", err);
        return { success: false, message: err.message };
    }
});

/**
 * Tarea programada: Todos los días 8 a las 10:00 AM (Zona Montevideo)
 * Recuerda a los alumnos regulares que no han abonado.
 */
exports.sendMonthlyReminders = onSchedule({
    schedule: "0 10 7 * *", // 10:00 AM del día 7
    timeZone: "America/Montevideo",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 300 // 5 minutos de tiempo máximo
}, async (event) => {
    const resend = getResend();

    try {
        const pendingStudents = await getStudentsToRemind(getDb());


        logger.info(`Iniciando recordatorios para ${pendingStudents.length} pendientes de pago.`);

        for (const student of pendingStudents) {
            try {
                const datesFormatted = student.attendanceDates.map(d => {
                    const dObj = new Date(d + 'T12:00:00');
                    return dObj.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
                }).join(', ');

                let debtMessage = "";
                if (student.isFullMonthly) {
                    debtMessage = `recordarte que el pago de la mensualidad se debe efectuar antes del <strong>día 10 de cada mes</strong>. El monto pendiente es de <strong>$${student.totalOwed}</strong>.`;
                } else {
                    const classWord = student.attendanceDates.length > 1 ? 'las clases' : 'la clase';
                    const dateWord = student.attendanceDates.length > 1 ? 'de los días' : 'del día';
                    debtMessage = `recordarte que tienes pendiente el pago de <strong>$${student.totalOwed}</strong> por ${classWord} ${dateWord} <strong>${datesFormatted}</strong>.`;
                }

                await resend.emails.send({
                    from: "Ventarrón <info@escueladetangoventarron.com>",
                    to: [student.email],
                    reply_to: "escueladetangoventarron@gmail.com",
                    subject: "Recordatorio de Pago - Ventarrón",
                    html: `
                        <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p>Hola <strong>${student.name}</strong>,</p>
                            <p>Te enviamos este mensajito para ${debtMessage}</p>
                            <p>Muchas gracias por elegirnos y por compartir el baile con nosotros.</p>
                            <br/>
                            <p style="text-align: center; font-style: italic;">¡Nos vemos en pista! 💃✨</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p style="font-size: 10px; opacity: 0.4; text-align: center;">Este es un recordatorio automático del sistema de administración de Ventarrón.</p>
                        </div>
                    `
                });
                logger.info(`Recordatorio enviado a ${student.name} (${student.email})`);
            } catch (sendError) {
                logger.error(`Error enviando email a ${student.email}:`, sendError);
            }
            // Esperar 1 segundo antes del próximo envío para respetar el rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        logger.error("Error en tarea de recordatorios", error);
    }
});

/**
 * Función manual para PROBAR recordatorios.
 * Envía un correo de ejemplo a la dirección especificada.
 */
exports.triggerTestReminder = onCall({
    secrets: ["RESEND_API_KEY"],
    enforceAppCheck: false,
    region: "us-central1"
}, async (request) => {
    if (!request.auth) throw new Error("Sin permisos.");

    const { testEmail } = request.data;
    const resend = getResend();

    try {
        const { data, error } = await resend.emails.send({
            from: "Ventarrón <info@escueladetangoventarron.com>",
            to: [testEmail],
            reply_to: "escueladetangoventarron@gmail.com",
            subject: "[PRUEBA] Recordatorio de Mensualidad - Ventarrón",
            html: `
                <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                    <p>Hola <strong>ALUMNO DE PRUEBA</strong>,</p>
                    <p>Te enviamos este mensajito para recordarte que el pago de la mensualidad se debe efectuar antes del <strong>día 10 de cada mes</strong>.</p>
                    <p>Muchas gracias por elegirnos y por compartir el baile con nosotros.</p>
                    <br/>
                    <p style="text-align: center; font-style: italic;">¡Nos vemos en pista! 💃✨</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                    <p style="font-size: 10px; opacity: 0.4; text-align: center;">Este es un recordatorio automático del sistema de administración de Ventarrón. (MODO PRUEBA)</p>
                </div>
            `
        });

        if (error) return { success: false, error };
        return { success: true, message: `Email de prueba enviado a ${testEmail}` };
    } catch (err) {
        logger.error("Error en triggerTestReminder", err);
        return { success: false, message: err.message };
    }
});

/**
 * Función manual para OBTENER la lista de deudores actuales.
 */
exports.getPendingReminders = onCall({
    region: "us-central1"
}, async (request) => {
    if (!request.auth) throw new Error("Sin permisos.");
    try {
        const monthPrefix = request.data?.monthPrefix;
        const pending = await getStudentsToRemind(getDb(), monthPrefix);
        return {
            success: true,
            students: pending.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email,
                attendanceDates: s.attendanceDates,
                attendanceDetails: s.attendanceDetails,
                totalOwed: s.totalOwed,
                classDebt: s.classDebt,
                practiceDebt: s.practiceDebt,
                isFullMonthly: s.isFullMonthly
            }))
        };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

/**
 * Función manual para DISPARAR los recordatorios a todos los deudores.
 */
exports.triggerManualReminders = onCall({
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 300,
    region: "us-central1"
}, async (request) => {
    if (!request.auth) throw new Error("Sin permisos.");
    const resend = getResend();

    try {
        const monthPrefix = request.data?.monthPrefix;
        const studentId = request.data?.studentId;
        let pending = await getStudentsToRemind(getDb(), monthPrefix);
        if (studentId) {
            pending = pending.filter(s => s.id === studentId);
        }
        logger.info(`Disparo manual de recordatorios para ${pending.length} pendientes en el mes ${monthPrefix || 'actual'}.`);

        for (const student of pending) {
            try {
                const datesFormatted = student.attendanceDates.map(d => {
                    const dObj = new Date(d + 'T12:00:00');
                    return dObj.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
                }).join(', ');

                let debtMessage = "";
                if (student.isFullMonthly) {
                    debtMessage = `recordarte que el pago de la mensualidad se debe efectuar antes del <strong>día 10 de cada mes</strong>. El monto pendiente es de <strong>$${student.totalOwed}</strong>.`;
                } else {
                    const classWord = student.attendanceDates.length > 1 ? 'las clases' : 'la clase';
                    const dateWord = student.attendanceDates.length > 1 ? 'de los días' : 'del día';
                    debtMessage = `recordarte que tienes pendiente el pago de <strong>$${student.totalOwed}</strong> por ${classWord} ${dateWord} <strong>${datesFormatted}</strong>.`;
                }

                await resend.emails.send({
                    from: "Ventarrón <info@escueladetangoventarron.com>",
                    to: [student.email],
                    reply_to: "escueladetangoventarron@gmail.com",
                    subject: "Recordatorio de Pago - Ventarrón",
                    html: `
                        <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p>Hola <strong>${student.name}</strong>,</p>
                            <p>Te enviamos este mensajito para ${debtMessage}</p>
                            <p>Muchas gracias por elegirnos y por compartir el baile con nosotros.</p>
                            <br/>
                            <p style="text-align: center; font-style: italic;">¡Nos vemos en pista! 💃✨</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p style="font-size: 10px; opacity: 0.4; text-align: center;">Este es un recordatorio automático del sistema de administración de Ventarrón.</p>
                        </div>
                    `
                });
            } catch (e) {
                logger.error(`Error enviando a ${student.email}`, e);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return { success: true, count: pending.length };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

/**
 * Tarea programada: Reporte Mensual General y Planillas por Clase
 * Se ejecuta a las 9:00 del día 1 de cada mes.
 * Genera el reporte del mes anterior.
 */
exports.sendMonthlyReport = onSchedule({
    schedule: "0 9 1 * *",
    timeZone: "America/Montevideo",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 540 // 9 minutos máximo
}, async (event) => {
    // 1. Obtener la fecha para el mes anterior
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const resend = getResend();
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const selectedMonth = targetDate.getMonth();
    const selectedYear = targetDate.getFullYear();
    const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
    const yearMonth = `${selectedYear}-${monthStr}`;

    try {
        // 2. Obtener datos necesarios
        const studentsSnap = await getDb().collection('students').get();
        const classesSnap = await getDb().collection('classes').get();
        const recordsSnap = await getDb().collection('attendance_records')
            .where('date', '>=', `${yearMonth}-01`)
            .where('date', '<=', `${yearMonth}-31`)
            .get();

        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const dayOfWeekMap = {
            'Sunday': 'Domingo', 'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
            'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado'
        };

        const monthlyPriceLevels = new Set();
        classes.forEach(c => {
            if (c.monthlyPrice) monthlyPriceLevels.add(Number(c.monthlyPrice));
            if (c.monthly2xsPrice) monthlyPriceLevels.add(Number(c.monthly2xsPrice));
        });

        const classIncomeMap = {};
        classes.forEach(c => {
            classIncomeMap[c.id] = { total: 0, cash: 0, transfer: 0 };
        });

        records.forEach(r => {
            const amount = parseFloat(r.paymentAmount) || 0;
            if (amount <= 0) return;

            const isMonthly = r.isMonthlyCovered || monthlyPriceLevels.has(amount);
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

        // 3. Replicar lógica de cálculo de Reports.jsx
        const classBreakdown = classes.map(cls => {
            let classRecords = records.filter(r => r.classId === cls.id);

            // Filtramos por día programado
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

            const totalAttendances = classRecords.filter(r => r.present).length;
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
                classRecords
            };
        });

        // Filtrar clases/prácticas inactivas en este mes (Modificación 1)
        const activeClassBreakdown = classBreakdown.filter(c => c.sessionsHeld > 0);

        // 4. Generar CSV de Balance General
        const balanceHeader = ["Clase", "Dia/Hora", "Sesiones", "Ingreso Total", "Efectivo", "Transferencia", "Alquiler", "Ganancia Total", "División", "Ganancia Final"];
        const balanceRows = activeClassBreakdown.map(c => {
            let dayTimeStr = `${c.day} ${c.time}`;
            if (c.isPractice && c.date) {
                const dObj = new Date(c.date + 'T12:00:00');
                const dNameEn = dObj.toLocaleDateString('en-US', { weekday: 'long' });
                const dayName = dayOfWeekMap[dNameEn] || c.day;
                const datePart = new Date(c.date + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
                dayTimeStr = `${dayName} ${datePart} ${c.time || ''}`.trim();
            }
            return [
                c.name,
                dayTimeStr,
                c.sessionsHeld,
                c.totalIncome,
                c.cashIncome,
                c.transferIncome,
                c.totalRent,
                c.profitBeforeSplit,
                c.profitSplit === 1 ? "100%" : "50/50",
                c.userProfit
            ];
        });
        const balanceCSV = [balanceHeader.join(","), ...balanceRows.map(row => row.join(","))].join("\n");

        // 5. Generar un CSV por cada clase activa (Modificación 1 y 2)
        const attachments = [
            {
                filename: `Balance_Ventarron_${months[selectedMonth]}_${selectedYear}.csv`,
                content: Buffer.from(balanceCSV),
            }
        ];

        activeClassBreakdown.forEach(cls => {
            const relevantStudentIds = [...new Set(cls.classRecords.filter(r => r.studentId !== 'NO_CLASS').map(r => r.studentId))];
            const relevantStudents = relevantStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));

            const classDates = cls.sessionDates;
            const headers = ["Alumno", ...classDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })), "Pagado en este grupo", "TOTAL ASIGNADO"];

            const rows = relevantStudents.map(student => {
                let studentLocalTotal = 0;
                const columns = classDates.map(date => {
                    const rec = cls.classRecords.find(r => r.studentId === student.id && r.date === date);
                    if (!rec) return "-";
                    const amount = parseFloat(rec.paymentAmount) || 0;
                    studentLocalTotal += amount;
                    let mark = "A";
                    if (rec.isGuest) mark = "INV";
                    else if (rec.isRecovery || !(student.enrolledClasses || []).includes(cls.id)) mark = "R";
                    let cell = rec.present ? `[${mark}]` : "[-] ";
                    if (amount > 0) cell += ` $${amount}`;
                    return cell.replace(/,/g, ''); // Limpiar comas para CSV
                });

                // Calcular cuánto de las mensualidades del alumno corresponden a ESTA clase
                const studentAllRecords = records.filter(r => r.studentId === student.id);
                let totalAssignedToThisClass = 0;

                studentAllRecords.forEach(r => {
                    const amount = parseFloat(r.paymentAmount) || 0;
                    if (amount <= 0) return;

                    const isMonthly = r.isMonthlyCovered || monthlyPriceLevels.has(amount);
                    const enrolled = student?.enrolledClasses || [];

                    if (isMonthly && enrolled.length > 0) {
                        if (enrolled.includes(cls.id)) {
                            totalAssignedToThisClass += amount / enrolled.length;
                        }
                    } else if (r.classId === cls.id) {
                        // Pago individual en esta clase
                        totalAssignedToThisClass += amount;
                    }
                });

                return [
                    student.name,
                    ...columns,
                    `$${studentLocalTotal}`,
                    `$${Math.round(totalAssignedToThisClass)}` + (studentLocalTotal !== totalAssignedToThisClass ? " (*)" : "")
                ];
            });

            // Cálculos de resumen financiero para esta clase (Modificación 2)
            const totalIncomeLabel = `Total Ingresos Asignados (Prorrateo):,$${cls.totalIncome}`;
            const totalRentLabel = `Alquiler (${cls.sessionsHeld} días):,$${cls.totalRent}`;
            const profitToSplitLabel = `Ganancia a repartir:,$${cls.profitBeforeSplit}`;

            let profitSplitRows = [];
            if (cls.profitSplit === 1) {
                profitSplitRows.push(`Ganancia Profesor (100%):,$${cls.userProfit}`);
            } else {
                const partnerProfit = cls.profitBeforeSplit * (1 - cls.profitSplit);
                profitSplitRows.push(`Ganancia Profesor 1:,$${cls.userProfit}`);
                profitSplitRows.push(`Ganancia Profesor 2:,$${partnerProfit}`);
            }

            const clsCSV = [
                [`Detalle de Asistencia y Pagos - ${cls.name}`, `${months[selectedMonth]} ${selectedYear}`].join(","),
                [`Ingreso Total (Redistribuido): $${cls.totalIncome}`, `(*) El monto asignado considera el reparto de pases libres y mensualidades entre grupos.`].join(","),
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

            attachments.push({
                filename: `Planilla_${cls.name.replace(/\s+/g, '_')}_${months[selectedMonth]}.csv`,
                content: Buffer.from(clsCSV)
            });
        });

        // 6. Enviar Email
        const totalIncomeText = activeClassBreakdown.reduce((acc, c) => acc + c.totalIncome, 0).toLocaleString();
        const totalProfitText = activeClassBreakdown.reduce((acc, c) => acc + c.userProfit, 0).toLocaleString();

        const { data, error } = await resend.emails.send({
            from: "Ventarrón Gestión <info@escueladetangoventarron.com>",
            to: ["escueladetangoventarron@gmail.com"],
            subject: `Reporte de Gestión - ${months[selectedMonth]} ${selectedYear}`,
            attachments: attachments,
            html: `
                <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 600px;">
                    <h2>Resumen de Cierre de Mes</h2>
                    <p>Hola de nuevo, aquí tienes el reporte completo de <strong>${months[selectedMonth]} ${selectedYear}</strong>.</p>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Ingresos Brutos Totales:</strong> $${totalIncomeText}</p>
                        <p style="margin: 5px 0;"><strong>Tu Ganancia Final:</strong> $${totalProfitText}</p>
                    </div>
                    <p>Se adjuntan los siguientes archivos:</p>
                    <ul>
                        <li>Balance General mensual</li>
                        <li>Planilla detallada de cada una de las ${activeClassBreakdown.length} clases</li>
                    </ul>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
                    <p style="font-size: 11px; opacity: 0.5;">Enviado automáticamente por el gestor de asistencias de Ventarrón.</p>
                </div>
            `
        });

        if (error) {
            logger.error("Error enviando reporte mensual:", error);
        } else {
            logger.info(`Reporte mensual enviado con éxito. ID: ${data.id}`);
        }

    } catch (err) {
        logger.error("Error crítico en sendMonthlyReport:", err);
    }
});

/**
 * Tarea programada: Todos los días a las 9:00 AM (Zona Montevideo)
 * Verifica si hay cumpleaños hoy y si las notificaciones están activas.
 */
exports.sendBirthdayNotifications = onSchedule({
    schedule: "0 9 * * *", // 9:00 AM todos los días
    timeZone: "America/Montevideo",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 300
}, async (event) => {
    try {
        // 1. Verificar si las notificaciones están habilitadas
        const settingsDoc = await getDb().collection('settings').doc('admin').get();
        if (!settingsDoc.exists || settingsDoc.data().birthdayEmailsEnabled !== true) {
            logger.info("Notificaciones de cumpleaños deshabilitadas o no configuradas. Saltando.");
            return;
        }

        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentDay = now.getDate(); // 1-31

        // 2. Obtener alumnos
        const studentsSnap = await getDb().collection('students').get();
        const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Filtrar los que cumplen hoy
        const birthdayStudents = students.filter(s => 
            s.birthMonth && s.birthDay && 
            Number(s.birthMonth) === currentMonth && 
            Number(s.birthDay) === currentDay
        );

        if (birthdayStudents.length === 0) {
            logger.info(`No hay cumpleaños registrados para el día de hoy (${currentDay}/${currentMonth}).`);
            return;
        }

        // 4. Enviar email al administrador
        const resend = getResend();
        
        let studentsListHtml = birthdayStudents.map(s => `<li style="margin-bottom: 10px;"><strong>${s.name}</strong>${s.phone ? `<br><a href="https://wa.me/${s.phone.replace(/\D/g, '')}" style="color: #2ecc71; font-size: 14px; text-decoration: none;">Enviar WhatsApp</a>` : ''}</li>`).join('');

        const { data, error } = await resend.emails.send({
            from: "Ventarrón Gestión <info@escueladetangoventarron.com>",
            to: ["escueladetangoventarron@gmail.com"],
            subject: `🎂 Cumpleaños de hoy: ${birthdayStudents.map(s => s.name).join(', ')}`,
            html: `
                <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                    <h2 style="color: #e67e22; text-align: center;">¡Avisos de Cumpleaños! 🎉</h2>
                    <p>Hola, este es un aviso automático de que hoy <strong>${currentDay}/${currentMonth}</strong> cumplen años los siguientes alumnos:</p>
                    <ul style="background: #f9f9f9; padding: 15px 15px 15px 35px; border-radius: 8px;">
                        ${studentsListHtml}
                    </ul>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                    <p style="font-size: 10px; opacity: 0.4; text-align: center;">Este es un recordatorio automático del sistema de administración de Ventarrón.<br>Puedes desactivar esto desde la pestaña de Cumpleaños en la app.</p>
                </div>
            `
        });

        if (error) {
            logger.error("Error enviando reporte de cumpleaños:", error);
        } else {
            logger.info(`Reporte de cumpleaños enviado con éxito. ID: ${data?.id}`);
        }

    } catch (error) {
        logger.error("Error crítico en sendBirthdayNotifications:", error);
    }
});

// Utilidad simple para escapar caracteres HTML y prevenir XSS
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Filtro heurístico de firmas de spam conocidas usadas por redes de bots
 */
function isKnownSpam(name, email, message) {
    const combined = `${name} ${message}`.toLowerCase();

    // 1. Plantilla recurrente de bots que anexan el título o H1 del sitio
    if (/por favor,?\s*cont[aá]ctenme por correo electr[oó]nico/i.test(combined)) return true;
    if (/—\s*clases de tango en montevideo/i.test(combined)) return true;
    if (/clases de tango en montevideo/i.test(message) && message.trim().length < 130 && /cont[aá]ct/i.test(message)) return true;

    // 2. Mensajes basura en otros idiomas no pertinentes (ej. bot vasco/euskera)
    if (/kaixo,?\s*zure\s*prezioa/i.test(combined)) return true;
    if (/zure\s*prezioa\s*jakin/i.test(combined)) return true;

    // 3. Spam típico de SEO, cripto o enlaces promocionales no deseados
    if (/(?:seo|backlink|guest post|ranking|crypto|bitcoin|forex)/i.test(combined)) return true;
    if (/(?:https?:\/\/|www\.)\S+/i.test(message) && !/(?:instagram|facebook|wa\.me)/i.test(message)) return true;

    return false;
}

// Registro en memoria de solicitudes por IP para limitar abusos (Rate Limiting)
const ipRateLimitMap = new Map();
function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // Ventana de 15 minutos
    const maxRequests = 4; // Máximo 4 envíos cada 15 minutos

    const timestamps = (ipRateLimitMap.get(ip) || []).filter(t => (now - t) < windowMs);
    timestamps.push(now);
    ipRateLimitMap.set(ip, timestamps);

    // Limpieza preventiva si el mapa crece
    if (ipRateLimitMap.size > 500) {
        for (const [key, times] of ipRateLimitMap.entries()) {
            if (times.every(t => (now - t) >= windowMs)) {
                ipRateLimitMap.delete(key);
            }
        }
    }

    return timestamps.length > maxRequests;
}

/**
 * Valida opcionalmente el token de reCAPTCHA v3 si RECAPTCHA_SECRET_KEY está configurada
 */
async function verifyRecaptcha(token, remoteIp) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        return { success: true, score: 1.0 };
    }

    if (!token) {
        return { success: false, error: "Token de reCAPTCHA no proporcionado." };
    }

    try {
        const params = new URLSearchParams();
        params.append("secret", secretKey);
        params.append("response", token);
        if (remoteIp) {
            params.append("remoteip", remoteIp);
        }

        const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
        });

        const data = await response.json();
        return data;
    } catch (err) {
        logger.error("Error al contactar con la API de reCAPTCHA:", err);
        return { success: true, score: 0.9, error: err.message };
    }
}

/**
 * Función HTTP Cloud Functions v2 para procesar consultas del formulario de la web pública (ES / EN)
 */
exports.contactForm = onRequest(
    {
        cors: true,
        region: "us-central1",
        secrets: ["RESEND_API_KEY"]
    },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).json({
                success: false,
                error: "Método no permitido. Utiliza POST."
            });
        }

        try {
            const { name, email, message, lang, recaptchaToken, company, duration } = req.body || {};
            const isEn = lang === "en";
            const clientIp = req.ip || req.headers["x-forwarded-for"] || "";

            // Mensaje de éxito estándar para respuestas silenciosas a bots
            const genericSuccessMsg = isEn
                ? "Message sent successfully! We will get back to you soon."
                : "¡Mensaje enviado con éxito! Te responderemos pronto.";

            // 1. CAPA 1: Trampa invisible (Honeypot)
            // Si el campo oculto "company" contiene texto, es indudablemente un bot.
            if (typeof company === "string" && company.trim().length > 0) {
                logger.warn("Bot bloqueado por trampa Honeypot:", { ip: clientIp, name, email, company });
                return res.status(200).json({ success: true, message: genericSuccessMsg });
            }

            // 2. CAPA 2: Control de tiempo de llenado (Time-to-submit)
            // Un humano tarda al menos 2.5 segundos en escribir nombre, correo y mensaje.
            // Si duration viene reportada y es menor a 2.5s, o es un valor anómalo, se descarta silenciosamente.
            if (typeof duration === "number" && duration < 2.5) {
                logger.warn("Bot bloqueado por tiempo de envío instantáneo (< 2.5s):", { ip: clientIp, duration, name, email });
                return res.status(200).json({ success: true, message: genericSuccessMsg });
            }

            // 3. CAPA 3: Detección heurística de firmas y textos de spambots
            const trimmedName = typeof name === "string" ? name.trim() : "";
            const trimmedEmail = typeof email === "string" ? email.trim() : "";
            const trimmedMessage = typeof message === "string" ? message.trim() : "";

            if (isKnownSpam(trimmedName, trimmedEmail, trimmedMessage)) {
                logger.warn("Bot bloqueado por firma de spam conocida:", { ip: clientIp, name: trimmedName, email: trimmedEmail, message: trimmedMessage });
                return res.status(200).json({ success: true, message: genericSuccessMsg });
            }

            // 4. CAPA 4: Límite de tasa por IP (Rate Limiting)
            if (isRateLimited(clientIp)) {
                logger.warn("Envío bloqueado por exceso de solicitudes desde la misma IP (Rate Limit):", { ip: clientIp });
                return res.status(200).json({ success: true, message: genericSuccessMsg });
            }

            // 5. CAPA 5: Verificación de reCAPTCHA v3 si está configurado
            const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIp);
            if (!recaptchaResult.success || (typeof recaptchaResult.score === "number" && recaptchaResult.score < 0.5)) {
                logger.warn("Envío bloqueado por reCAPTCHA v3:", recaptchaResult);
                return res.status(403).json({
                    success: false,
                    error: isEn
                        ? "Security verification failed. Please try again or contact us via WhatsApp."
                        : "No se pudo verificar la seguridad del envío. Por favor, intenta nuevamente o escríbenos por WhatsApp."
                });
            }

            // 6. Validaciones básicas de campos
            if (!trimmedName || !trimmedEmail || !trimmedMessage) {
                return res.status(400).json({
                    success: false,
                    error: isEn
                        ? "Name, Email and Message are required."
                        : "Los campos Nombre, Email y Mensaje son obligatorios."
                });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                return res.status(400).json({
                    success: false,
                    error: isEn
                        ? "Please enter a valid email address."
                        : "La dirección de correo electrónico no es válida."
                });
            }

            if (trimmedName.length > 120 || trimmedMessage.length > 4000) {
                return res.status(400).json({
                    success: false,
                    error: isEn
                        ? "Name or message exceeds the maximum allowed length."
                        : "El nombre o mensaje excede la longitud permitida."
                });
            }

            const resend = getResend();
            const SENDER_ES = "Escuela de Tango Ventarrón <info@escueladetangoventarron.com>";
            const SENDER_EN = "Ventarrón Tango School <info@escueladetangoventarron.com>";
            const SCHOOL_RECIPIENT = "escueladetangoventarron@gmail.com";

            // 7. Plantilla HTML de notificación para la escuela
            const schoolHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
                        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                        .header { background: linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%); color: #ffffff; padding: 24px 28px; border-bottom: 3px solid #e74c3c; }
                        .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
                        .header p { margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; }
                        .content { padding: 28px; }
                        .field-box { margin-bottom: 18px; background: #f8fafc; border-radius: 8px; padding: 14px 18px; border-left: 4px solid #e74c3c; }
                        .field-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px; }
                        .field-value { font-size: 15px; color: #0f172a; font-weight: 500; }
                        .message-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-top: 20px; }
                        .message-label { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
                        .message-content { font-size: 15px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; }
                        .footer { background: #f1f5f9; padding: 16px 28px; text-align: center; font-size: 12px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Nueva Consulta Web - Ventarrón</h1>
                            <p>Recibida desde escueladetangoventarron.com (${isEn ? "Versión Inglés" : "Versión Español"})</p>
                        </div>
                        <div class="content">
                            <div class="field-box">
                                <div class="field-label">Nombre</div>
                                <div class="field-value">${escapeHtml(trimmedName)}</div>
                            </div>
                            <div class="field-box">
                                <div class="field-label">Correo Electrónico</div>
                                <div class="field-value"><a href="mailto:${escapeHtml(trimmedEmail)}" style="color:#e74c3c; text-decoration:none;">${escapeHtml(trimmedEmail)}</a></div>
                            </div>
                            <div class="message-box">
                                <div class="message-label">Mensaje:</div>
                                <div class="message-content">${escapeHtml(trimmedMessage)}</div>
                            </div>
                        </div>
                        <div class="footer">
                            Puedes responder directamente a este correo para escribirle a <strong>${escapeHtml(trimmedName)}</strong>.
                        </div>
                    </div>
                </body>
                </html>
            `;

            // 8. Enviar correo a la escuela
            const schoolResult = await resend.emails.send({
                from: SENDER_ES,
                to: SCHOOL_RECIPIENT,
                replyTo: `${trimmedName} <${trimmedEmail}>`,
                reply_to: `${trimmedName} <${trimmedEmail}>`,
                headers: {
                    "Reply-To": `${trimmedName} <${trimmedEmail}>`
                },
                subject: `Consulta Web Ventarrón - ${trimmedName}`,
                html: schoolHtml
            });

            if (schoolResult.error) {
                logger.error("Error al enviar email a la escuela con Resend:", schoolResult.error);
                return res.status(500).json({
                    success: false,
                    error: isEn
                        ? "Could not send the message at this time."
                        : "No se pudo procesar el envío del correo en este momento."
                });
            }

            logger.info(`Consulta web enviada exitosamente para ${trimmedName} (${trimmedEmail}). ID: ${schoolResult.data?.id}`);

            // 9. Enviar acuse de recibo al visitante
            try {
                const ackHtml = isEn
                    ? `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
                                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                                .header { background: linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%); color: #ffffff; padding: 28px; text-align: center; border-bottom: 3px solid #e74c3c; }
                                .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
                                .content { padding: 28px; font-size: 15px; line-height: 1.6; color: #334155; }
                                .box { background: #f8fafc; border-left: 4px solid #e74c3c; padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-size: 14px; white-space: pre-wrap; }
                                .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>Ventarrón Tango School</h1>
                                    <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">Tango Classes & Milongas in Montevideo</p>
                                </div>
                                <div class="content">
                                    <p>Hello <strong>${escapeHtml(trimmedName)}</strong>,</p>
                                    <p>We have received your inquiry through our website. Thank you for reaching out to us!</p>
                                    <p>Our team will review your message and get back to you very soon.</p>
                                    <div class="box"><strong>Your message:</strong><br><em>"${escapeHtml(trimmedMessage)}"</em></div>
                                    <p>If you prefer a faster reply via WhatsApp, feel free to write to us at <a href="https://wa.me/59899627941" style="color:#e74c3c; font-weight:600; text-decoration:none;">(+598) 099 627941</a>.</p>
                                    <p style="text-align: center; font-style: italic; margin-top: 24px;">See you on the dance floor! 💃✨</p>
                                </div>
                                <div class="footer">
                                    Escuela de Tango Ventarrón &bull; Durazno 1666, Montevideo, Uruguay<br>
                                    <a href="https://escueladetangoventarron.com" style="color:#e74c3c; text-decoration:none;">escueladetangoventarron.com</a>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                    : `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
                                .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                                .header { background: linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%); color: #ffffff; padding: 28px; text-align: center; border-bottom: 3px solid #e74c3c; }
                                .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
                                .content { padding: 28px; font-size: 15px; line-height: 1.6; color: #334155; }
                                .box { background: #f8fafc; border-left: 4px solid #e74c3c; padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-size: 14px; white-space: pre-wrap; }
                                .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>Escuela de Tango Ventarrón</h1>
                                    <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">Clases de Tango y Milongas en Montevideo</p>
                                </div>
                                <div class="content">
                                    <p>Hola <strong>${escapeHtml(trimmedName)}</strong>,</p>
                                    <p>Hemos recibido tu consulta a través de nuestro sitio web. ¡Muchas gracias por escribirnos!</p>
                                    <p>Te responderemos a la brevedad.</p>
                                    <div class="box"><strong>Resumen de tu mensaje:</strong><br><em>"${escapeHtml(trimmedMessage)}"</em></div>
                                    <p>Si deseas comunicarte de forma inmediata por WhatsApp, puedes escribirnos al <a href="https://wa.me/59899627941" style="color:#e74c3c; font-weight:600; text-decoration:none;">(+598) 099 627941</a>.</p>
                                    <p style="text-align: center; font-style: italic; margin-top: 24px;">¡Nos vemos en pista! 💃✨</p>
                                </div>
                                <div class="footer">
                                    Escuela de Tango Ventarrón &bull; Durazno 1666, Montevideo, Uruguay<br>
                                    <a href="https://escueladetangoventarron.com" style="color:#e74c3c; text-decoration:none;">escueladetangoventarron.com</a>
                                </div>
                            </div>
                        </body>
                        </html>
                    `;

                const senderHeader = isEn ? SENDER_EN : SENDER_ES;
                await resend.emails.send({
                    from: senderHeader,
                    to: trimmedEmail,
                    replyTo: senderHeader,
                    reply_to: senderHeader,
                    headers: {
                        "Reply-To": senderHeader
                    },
                    subject: isEn
                        ? "We have received your inquiry - Ventarrón Tango School"
                        : "Hemos recibido tu consulta - Escuela de Tango Ventarrón",
                    html: ackHtml
                });
            } catch (ackError) {
                logger.warn("No se pudo enviar el correo de confirmación al visitante:", ackError);
            }

            return res.status(200).json({
                success: true,
                message: genericSuccessMsg
            });
        } catch (err) {
            logger.error("Error inesperado en contactForm:", err);
            return res.status(500).json({
                success: false,
                error: "Ocurrió un error inesperado al procesar tu solicitud."
            });
        }
    }
);
