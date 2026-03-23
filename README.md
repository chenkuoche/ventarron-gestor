# Ventarrón - Gestor de Escuela de Tango

Esta aplicación ha sido diseñada específicamente para la **Escuela de Tango Ventarrón**, permitiendo gestionar alumnos, asistencia, pagos y reportes financieros de manera sencilla y eficiente.

## Características

1.  **Registro de Alumnos**: Formulario fácil para inscribir alumnos con nombre, teléfono y email.
2.  **Control de Asistencia y Pagos**:
    *   Listado dinámico por clase.
    *   Marcado de asistencia con un solo click.
    *   Registro de montos pagados y medio de pago (Efectivo o Transferencia).
3.  **Gestión de Clases**: 
    *   Configuración de días, horarios y valores de alquiler por sesión.
    *   Lógica de división de ganancias configurable (ej: 100% para clases en pareja, 50% para clases compartidas con otros profesores).
4.  **Reportes Financieros**:
    *   Cálculo automático de ingresos brutos por mes.
    *   Diferenciación automática entre Efectivo y Transferencia.
    *   Cálculo de ganancias netas restando el alquiler del salón.
    *   Desglose detallado por clase.

## Estética
El diseño utiliza una paleta de colores elegante basada en la web oficial:
- **Azul Pizarra/Gris**: Profesional y moderno.
- **Rojo Coral**: Para acciones principales y acentos destacados.
- **Tipografía Moderna**: Legibilidad máxima.

## Cómo ejecutar localmente

1.  Asegúrate de estar en el directorio del proyecto: `/Users/chenkuoche/.gemini/antigravity/scratch/ventarron-gestor`
2.  Instala las dependencias (si no lo has hecho): `npm install`
3.  Inicia el servidor de desarrollo: `npm run dev`
4.  Abre `http://localhost:5173` en tu navegador.

## Sugerencia
Se recomienda establecer esta carpeta como tu **espacio de trabajo activo** para facilitar futuras modificaciones.

---
Diseñado con ❤️ para la Escuela de Tango Ventarrón.
