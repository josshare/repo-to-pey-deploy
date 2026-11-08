# Conectar los cobros de Pey con WhatsApp de Kapso

## Estado confirmado
- La conexión de **Pey** funciona: se consultaron las transacciones sin crear cobros.
- La conexión de **Kapso** funciona y tiene un número llamado **Sandbox WhatsApp**.
- La pantalla actual sigue siendo una demostración; conectar las cuentas todavía no reemplaza sus pagos ni mensajes simulados.
- Pey documenta únicamente producción. Incluso las pruebas con su cuenta bancaria de prueba pueden mover dinero real; la documentación indica que esos pagos no se devuelven.

## Qué se implementará
1. Conservar la demo separada de los cobros conectados para que sus botones simulados nunca confirmen pagos reales.
2. Recibir los mensajes del WhatsApp de prueba de Kapso y responder con el recorrido de cobro del negocio.
3. Sustituir la vinculación ficticia por el registro y estado de cuentas que documenta Pey, sin permitir activaciones manuales de cuentas reales.
4. Crear solicitudes CoDi con Pey, guardar su identificador y compartir el QR con el cliente por Kapso.
5. Confirmar el pago únicamente después de recibir una notificación válida de Pey que coincida con el cobro y el importe; avisar al negocio y al cliente.
6. Guardar mensajes, resultados de envío y notificaciones, evitando contabilizar dos veces un mismo pago.
7. Proteger el acceso a conversaciones y cobros reales; la sesión anónima de demo no dará acceso a esos datos.

## Configuración pendiente
- Publicar los receptores de notificaciones antes de configurar sus direcciones en Pey y Kapso.
- Guardar de forma segura los secretos de firma que requieren las notificaciones de ambos servicios.
- Configurar Kapso para enviar los mensajes del Sandbox WhatsApp a esta aplicación y completar los requisitos de destinatarios de prueba que indique Kapso.
- No enviar mensajes ni ejecutar una prueba de pago real sin autorización del usuario; cualquier pago de prueba debe mostrar claramente su importe y cuenta receptora.

## Validación
- Probar firmas inválidas, mensajes repetidos y notificaciones duplicadas o fuera de orden.
- Verificar que un botón de simulación no puede confirmar un cobro de Pey.
- Recorrer un cobro desde WhatsApp hasta su confirmación y comprobar que se lee de vuelta en la aplicación.
- Si falta la publicación, la firma o el pago autorizado, informar esa parte como pendiente, no como funcionando.

## Detalles técnicos
- Usar funciones del servidor para operaciones internas y direcciones públicas verificadas para las notificaciones externas.
- Pey: gateway `udc_pey`, autenticación guardada en `UDC_PEY_API_KEY`; crear QR con `POST /codi/qr` y verificar eventos con Standard Webhooks.
- Kapso: gateway `udc_kapso`, autenticación guardada en `UDC_KAPSO_API_KEY`; el número de prueba se obtiene de `GET /platform/v1/whatsapp/phone_numbers`.
- Almacenar eventos y trabajo pendiente de forma duradera en Lovable Cloud; procesarlos de manera recuperable, sin depender de memoria temporal.
- Añadir pruebas pequeñas para las validaciones de dinero, aislamiento entre demo y cobros conectados, deduplicación y reconciliación.