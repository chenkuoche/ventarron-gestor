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
    
    // 1. Obtener todos los alumnos
    const studentsSnap = await db.collection('students').get();
    // 2. Obtener registros de pago y asistencia de este mes
    const paymentsSnap = await db.collection('attendance_records')
        .where('date', '>=', `${monthPrefix}-01`)
        .get();
    
    // Identificar quiénes ya pagaron (monto > 0)
    const paidStudentIds = new Set(paymentsSnap.docs
        .filter(d => Number(d.data().paymentAmount) > 0)
        .map(d => d.data().studentId));

    // Identificar quiénes han asistido al menos una vez este mes (present === true)
    const attendeeIds = new Set(paymentsSnap.docs
        .filter(d => d.data().present === true)
        .map(d => d.data().studentId));

    // Filtrar pendientes: Con mail, inscritos en clases, que HAYAN ASISTIDO, que no hayan pagado y que no sean invitados
    return studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(s => 
            s.email && 
            (s.enrolledClasses && s.enrolledClasses.length > 0) &&
            attendeeIds.has(s.id) &&
            !paidStudentIds.has(s.id) &&
            (!s.guestClasses || s.guestClasses.length === 0)
        );
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
                await resend.emails.send({
                    from: "Ventarrón <info@escueladetangoventarron.com>",
                    to: [student.email],
                    reply_to: "escueladetangoventarron@gmail.com",
                    subject: "Recordatorio de Mensualidad - Ventarrón",
                    html: `
                        <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p>Hola <strong>${student.name}</strong>,</p>
                            <p>Te enviamos este mensajito para recordarte que el pago de la mensualidad se debe efectuar antes del <strong>día 10 de cada mes</strong>.</p>
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
        return { success: true, students: pending.map(s => ({ id: s.id, name: s.name, email: s.email })) };
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
                await resend.emails.send({
                    from: "Ventarrón <info@escueladetangoventarron.com>",
                    to: [student.email],
                    reply_to: "escueladetangoventarron@gmail.com",
                    subject: "Recordatorio de Mensualidad - Ventarrón",
                    html: `
                        <div style="font-family: sans-serif; color: #2c3e50; line-height: 1.6; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 10px;">
                            <div style="text-align: center; margin-bottom: 25px;">
                                <img src="https://asistencias-ventarron.web.app/logo_escuela_final.png" alt="Ventarrón" style="max-width: 250px; height: auto;" />
                            </div>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                            <p>Hola <strong>${student.name}</strong>,</p>
                            <p>Te enviamos este mensajito para recordarte que el pago de la mensualidad se debe efectuar antes del <strong>día 10 de cada mes</strong>.</p>
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


