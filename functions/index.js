const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { Resend } = require("resend");
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

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
    secrets: ["RESEND_API_KEY"]
}, async (event) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    try {
        // 1. Obtener todos los alumnos
        const studentsSnap = await db.collection('students').get();
        // 2. Obtener registros de pago de este mes
        const paymentsSnap = await db.collection('attendance_records')
            .where('date', '>=', `${monthPrefix}-01`)
            .get();
        
        // Identificar quiénes ya pagaron (monto > 0)
        const paidStudentIds = new Set(paymentsSnap.docs
            .filter(d => Number(d.data().paymentAmount) > 0)
            .map(d => d.data().studentId));

        // Filtrar pendientes: Con mail, inscritos en clases, que no hayan pagado y que no sean invitados
        const pendingStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(s => 
                s.email && 
                (s.enrolledClasses && s.enrolledClasses.length > 0) &&
                !paidStudentIds.has(s.id) &&
                (!s.guestClasses || s.guestClasses.length === 0)
            );

        logger.info(`Iniciando recordatorios para ${pendingStudents.length} pendientes de pago.`);

        for (const student of pendingStudents) {
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
                        <p>Si ya realizaste el pago en estos últimos días, por favor desestima este mensaje.</p>
                        <p>Muchas gracias por elegirnos y por compartir el baile con nosotros.</p>
                        <br/>
                        <p style="text-align: center; font-style: italic;">¡Nos vemos en pista! 💃✨</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
                        <p style="font-size: 10px; opacity: 0.4; text-align: center;">Este es un recordatorio automático del sistema de administración de Ventarrón.</p>
                    </div>
                `
            });
        }
        
    } catch (error) {
        logger.error("Error en tarea de recordatorios", error);
    }
});
