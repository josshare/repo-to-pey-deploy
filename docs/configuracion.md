# Configuración y operación

[Volver al README](../README.md)

## Desarrollo local

Requisitos: Bun y un entorno configurado para las funciones de Lovable Cloud. Un clon del código no incluye conexiones privadas ni una base de datos local lista.

```sh
bun install
bun run dev
```

Utiliza la dirección que muestre Vite. Las funciones de servidor y conexiones deben estar configuradas para probar persistencia y proveedores; abrir la pantalla no verifica esos servicios.

```sh
bun run test
```

No modifiques archivos de clientes generados ni copies `.env` o credenciales del entorno alojado al repositorio. Las migraciones están versionadas como referencia, pero su aplicación al entorno administrado se realiza mediante Lovable Cloud, no ejecutándolas manualmente contra producción.

## Configuración de servidor

Esta tabla muestra **nombres**, nunca valores secretos.

| Nombre | Uso |
| --- | --- |
| `LOVABLE_API_KEY` | Acceso del servidor al gateway de conexiones |
| `UDC_PEY_API_KEY` | Conexión privada vinculada de Pey |
| `UDC_KAPSO_API_KEY` | Credencial de conexión Kapso; no hay envío real implementado |
| `PEY_WEBHOOK_SECRET` | Verificar notificaciones firmadas de Pey |
| `KAPSO_WEBHOOK_SECRET` | Verificar HMAC de notificaciones Kapso |

Configura secretos con las herramientas de Lovable y los proveedores; nunca uses variables públicas `VITE_*` para estas claves. Tener claves presentes no certifica acceso válido al proveedor: el indicador «conectado» comprueba presencia de configuración, no una operación bancaria exitosa.

## Activación de pedidos reales

Estado pendiente documentado al preparar esta versión; comprobar de nuevo antes de activar:

- [ ] Crear el usuario del dueño por un procedimiento administrado y seguro. El panel actual permite iniciar sesión, **no registrarse**.
- [ ] Verificar una cuenta receptora utilizable en Pey.
- [ ] Habilitar al dueño en `live_payment_operators`, con su identificador de usuario y la cuenta receptora verificada. Esto es una operación administrativa, no algo editable desde el navegador.
- [ ] Configurar la firma de Pey y registrar el receptor de notificaciones.
- [ ] Confirmar que la última versión está publicada en el dominio de la demo.
- [ ] Ejecutar una sola prueba autorizada de **$0.01 MXN**, con consentimiento marcado, y verificar su resultado en el panel y en Pey.

No crear cobros durante la configuración. No aumentar el importe para probar «si funciona». Los pagos de prueba no se devuelven. Si una creación queda incierta, revisar el pedido y Pey antes de cualquier nueva solicitud.

## Receptores de notificaciones

Método: `POST`.

| Proveedor | URL del sitio |
| --- | --- |
| Pey | `https://hackathon.filmjx.com/api/public/pey/webhook` |
| Kapso | `https://hackathon.filmjx.com/api/public/kapso/webhook` |

Usar estas direcciones solo después de comprobar publicación y accesibilidad del dominio. Las URLs son públicas por necesidad; cada receptor valida la firma antes de acceder a los datos privados.

### Pey

Cabeceras esperadas: `webhook-id`, `webhook-timestamp` y `webhook-signature`. La verificación usa `standardwebhooks` sobre el cuerpo original. El único evento conciliado es `codi.qr.payment_received`.

Campos requeridos por el código: `type`, `amount` igual a `0.01`, `bankAccountId`, `codiQrId`, `transactionId` y `datePaid` en segundos Unix. Antes de activar, confirmar ese contrato con una entrega real de Pey; no sustituirla por un JSON fabricado como evidencia.

### Kapso

Cabeceras esperadas por el receptor actual: `x-webhook-event` y `x-webhook-signature`, esta última HMAC-SHA256 en hexadecimal minúsculo del cuerpo original. Confirmar el formato con la configuración de la cuenta Kapso.

Aunque una firma sea válida y el evento se guarde, el procesamiento Kapso sigue pendiente y responde `503`. No usar este receptor como un bot operativo. Falta número, configuración de credenciales vigente, manejo de mensajes y envío de avisos.

## Observación y fallos

- Consultar pedidos del dueño, estados y transacciones mediante el panel autorizado.
- Revisar eventos en `live_provider_events` solo con acceso administrativo; contienen datos privados.
- Una respuesta `401` significa notificación no autenticada o cuerpo inválido; no se guarda.
- Una respuesta `413` significa cuerpo inválido o mayor que el límite de 1 MiB.
- Una respuesta `503` significa falta de configuración, fallo de persistencia/conciliación o procesamiento no activado. No equivale a «pago aplicado».
- `200` significa conciliación aceptada (`READY`, `DUPLICATE` o `REVIEW`); **no siempre** significa «listo para preparar».

No hay trabajador automático que reprocesse la bandeja ni procedimiento administrativo de resolución implementado. Los casos en revisión necesitan investigación antes de realizar acciones externas.