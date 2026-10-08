### Protocolo obligatorio de notificaciones móviles:
1. Al finalizar cualquier tarea, acción o ciclo de trabajo, ejecuta inmediatamente:
   ~/.antigravity-tools/notify.sh done "He terminado: [resumen breve de lo realizado]"

2. Si requieres que acepte, confirme o valide algo:
   - Si es BLOQUEANTE (no puedes seguir sin mi permiso):
     Ejecuta:
     ~/.antigravity-tools/notify.sh block "Necesito aprobación para: [motivo]. Proceso detenido."
     (Y detén la ejecución hasta que yo te responda).
   - Si NO ES BLOQUEANTE (puedes continuar de todas formas):
     Ejecuta:
     ~/.antigravity-tools/notify.sh warn "Revisa: [motivo], pero continúo con el resto."
     (Y continúa avanzando).
