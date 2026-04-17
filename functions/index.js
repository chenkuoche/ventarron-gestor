const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { Resend } = require("resend");
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

/**
 * Helper: Obtiene la lista de alumnos que deben mensualidad este mes
 * según los criterios: inscrito, ha asistido alguna vez y no ha pagado.
 */
async function getStudentsToRemind(db) {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Obtener alumnos, clases y registros
    const [studentsSnap, classesSnap, paymentsSnap] = await Promise.all([
        db.collection('students').get(),
        db.collection('classes').get(),
        db.collection('attendance_records').where('date', '>=', `${monthPrefix}-01`).get()
    ]);

    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const classes = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allRecords = paymentsSnap.docs.map(d => d.data());

    // Mapeo de precios de clases para cálculo rápido
    const classPricesMap = {};
    const monthlyPrices = new Set();
    classes.forEach(c => {
        classPricesMap[c.id] = {
            classPrice: Number(c.classPrice || 0),
            monthlyPrice: Number(c.monthlyPrice || 0),
            monthly2xsPrice: Number(c.monthly2xsPrice || 0)
        };
        if (c.monthlyPrice) monthlyPrices.add(Number(c.monthlyPrice));
        if (c.monthly2xsPrice) monthlyPrices.add(Number(c.monthly2xsPrice));
    });

    // Procesar cada alumno para ver si es deudor
    const pendingStudents = students.filter(s => {
        if (!s.email || !s.enrolledClasses || s.enrolledClasses.length === 0) return false;
        if (s.guestClasses && s.guestClasses.length > 0) return false;

        const studentRecords = allRecords.filter(r => r.studentId === s.id);
        const hasPL = studentRecords.some(r => r.isPL === true);
        if (hasPL) return false;

        const attendances = studentRecords.filter(r => r.present === true);
        if (attendances.length === 0) return false;

        const hasPaidMonthly = studentRecords.some(r => monthlyPrices.has(Number(r.paymentAmount)));
        if (hasPaidMonthly) return false;

        const hasUnpaidAttendance = attendances.some(r => Number(r.paymentAmount) <= 0);
        return hasUnpaidAttendance;
    });

    // Mapear con datos detallados para el mail
    return pendingStudents.map(s => {
        const studentRecords = allRecords.filter(r => r.studentId === s.id);
        const unpaidAttendances = studentRecords.filter(r => r.present === true && Number(r.paymentAmount) <= 0);

        let totalOwed = 0;
        let isFullMonthly = false;

        // Si el alumno está anotado en grupos, verificamos si su deuda total alcanza una mensualidad
        // o si simplemente sumamos por clase suelta. 
        // Por simplicidad para el usuario, si no pagó la mensualidad, calculamos la suma de las clases que asistió.
        unpaidAttendances.forEach(r => {
            const prices = classPricesMap[r.classId];
            if (prices) {
                totalOwed += prices.classPrice;
            }
        });

        // Caso especial: Si la suma de clases sueltas supera o iguala la mensualidad más barata que debería pagar,
        // sugerimos el monto de la mensualidad en su lugar (si es beneficioso para el alumno).
        const firstClass = s.enrolledClasses[0];
        const studentMonthlyPrice = s.enrolledClasses.length > 1
            ? classPricesMap[firstClass]?.monthly2xsPrice
            : classPricesMap[firstClass]?.monthlyPrice;

        if (studentMonthlyPrice && totalOwed >= studentMonthlyPrice) {
            totalOwed = studentMonthlyPrice;
            isFullMonthly = true;
        }

        return {
            id: s.id,
            name: s.name,
            email: s.email,
            attendanceDates: unpaidAttendances.map(r => r.date).sort(),
            totalOwed,
            isFullMonthly
        };
    });
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
    const resend = new Resend(process.env.RESEND_API_KEY);

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
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const pendingStudents = await getStudentsToRemind(db);


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
    const resend = new Resend(process.env.RESEND_API_KEY);

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
        const pending = await getStudentsToRemind(db);
        return {
            success: true,
            students: pending.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email,
                attendanceDates: s.attendanceDates,
                totalOwed: s.totalOwed,
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
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const pending = await getStudentsToRemind(db);
        logger.info(`Disparo manual de recordatorios para ${pending.length} pendientes.`);

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
 * Se ejecuta a las 23:00 de los días 28, 29, 30 y 31.
 * Verifica si es el último día del mes antes de proceder.
 */
exports.sendMonthlyReport = onSchedule({
    schedule: "0 23 28-31 * *",
    timeZone: "America/Montevideo",
    secrets: ["RESEND_API_KEY"],
    timeoutSeconds: 540 // 9 minutos máximo
}, async (event) => {
    // 1. Verificar si es el último día del mes
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (tomorrow.getDate() !== 1) {
        logger.info("Hoy no es el último día del mes. No se genera reporte.");
        return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const selectedMonth = today.getMonth();
    const selectedYear = today.getFullYear();
    const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
    const yearMonth = `${selectedYear}-${monthStr}`;

    try {
        // 2. Obtener datos necesarios
        const studentsSnap = await db.collection('students').get();
        const classesSnap = await db.collection('classes').get();
        const recordsSnap = await db.collection('attendance_records')
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

        // 3. Replicar lógica de cálculo de Reports.jsx
        const classBreakdown = classes.map(cls => {
            let classRecords = records.filter(r => r.classId === cls.id);

            // Filtramos por día programado
            classRecords = classRecords.filter(r => {
                if (r.studentId === 'NO_CLASS') return true;
                const dObj = new Date(r.date + 'T12:00:00');
                const dNameEn = dObj.toLocaleDateString('en-US', { weekday: 'long' });
                return dayOfWeekMap[dNameEn] === cls.day;
            });

            const incomeFromMap = classIncomeMap[cls.id] || { total: 0, cash: 0, transfer: 0 };
            const totalIncome = incomeFromMap.total;
            const cashIncome = incomeFromMap.cash;
            const transferIncome = incomeFromMap.transfer;

            const totalAttendances = classRecords.filter(r => r.present).length;
            const datesWithNoClass = new Set(classRecords.filter(r => r.studentId === 'NO_CLASS').map(r => r.date));
            const sessionDates = [...new Set(classRecords.filter(r => r.studentId !== 'NO_CLASS' && !datesWithNoClass.has(r.date)).map(r => r.date))].sort();
            const sessionsHeld = sessionDates.length;

            const totalRent = sessionsHeld * (cls.rent || 0);
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

        // 4. Generar CSV de Balance General
        const balanceHeader = ["Clase", "Dia/Hora", "Sesiones", "Ingreso Total", "Efectivo", "Transferencia", "Alquiler", "Ganancia Total", "División", "Ganancia Final"];
        const balanceRows = classBreakdown.map(c => [
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
        const balanceCSV = [balanceHeader.join(","), ...balanceRows.map(row => row.join(","))].join("\n");

        // 5. Generar un CSV por cada clase
        const attachments = [
            {
                filename: `Balance_Ventarron_${months[selectedMonth]}_${selectedYear}.csv`,
                content: Buffer.from(balanceCSV),
            }
        ];

        classBreakdown.forEach(cls => {
            const relevantStudentIds = [...new Set(cls.classRecords.filter(r => r.studentId !== 'NO_CLASS').map(r => r.studentId))];
            const relevantStudents = relevantStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es'));

            const classDates = cls.sessionDates;
            const headers = ["Alumno", ...classDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })), "Total Pagado"];

            const rows = relevantStudents.map(student => {
                let studentTotal = 0;
                const columns = classDates.map(date => {
                    const rec = cls.classRecords.find(r => r.studentId === student.id && r.date === date);
                    if (!rec) return "-";
                    const amount = parseFloat(rec.paymentAmount) || 0;
                    studentTotal += amount;
                    let mark = "A";
                    if (rec.isGuest) mark = "INV";
                    else if (rec.isRecovery || !(student.enrolledClasses || []).includes(cls.id)) mark = "R";
                    let cell = rec.present ? `[${mark}]` : "[-] ";
                    if (amount > 0) cell += ` $${amount}`;
                    return cell.replace(/,/g, ''); // Limpiar comas para CSV
                });
                return [student.name, ...columns, `$${studentTotal}`];
            });

            const clsCSV = [
                [`Detalle de Asistencia - ${cls.name}`, `${months[selectedMonth]} ${selectedYear}`].join(","),
                [],
                headers.join(","),
                ...rows.map(row => row.join(","))
            ].join("\n");

            attachments.push({
                filename: `Planilla_${cls.name.replace(/\s+/g, '_')}_${months[selectedMonth]}.csv`,
                content: Buffer.from(clsCSV)
            });
        });

        // 6. Enviar Email
        const totalIncomeText = classBreakdown.reduce((acc, c) => acc + c.totalIncome, 0).toLocaleString();
        const totalProfitText = classBreakdown.reduce((acc, c) => acc + c.userProfit, 0).toLocaleString();

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
                        <li>Planilla detallada de cada una de las ${classes.length} clases</li>
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
