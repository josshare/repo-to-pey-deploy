# Activar cobro real de $0.01 MXN y publicar

## Qué se hará
1. **Usar la cuenta «Prueba» vinculada a tu API key**: la app dejará de exigir un identificador de cuenta; al crear el QR no se envía ninguno y Pey deposita en la cuenta vinculada.
2. **Confirmación segura del pago**: un pago solo marca el pedido como pagado si coinciden el QR creado por la app y el monto exacto de $0.01. Si el pedido guardó una cuenta específica, también debe coincidir.
3. **Habilitar solo a josmtz.uber@gmail.com** como operador de cobros reales. Cualquier otra persona puede entrar con Google y ver la demo, pero no cobrar.
4. **Pruebas automáticas** para: QR sin cuenta explícita, pago con monto distinto rechazado, usuario no habilitado rechazado.
5. **Publicar** en hackathon.filmjx.com con visibilidad pública, tras revisar el escaneo de seguridad.

## Qué NO se publica (nada sensible)
- Ni la API key de Pey, ni el secreto del webhook, ni la CLABE, ni correos en código o documentación.
- Los secretos siguen solo en el servidor; la habilitación del operador vive en la base de datos, no en el código.
- Se revisará README y docs para confirmar que no contienen valores privados.

## Detalles técnicos
- Migración: `live_payment_operators.bank_account_id` y `live_orders.bank_account_id` pasan a nullable; la función de conciliación compara cuenta solo cuando el pedido la tiene, y siempre exige `provider_qr_id` + monto 1 centavo + estado PENDING.
- `qrRequest` omite `bankAccountId` cuando es null; `createLiveOrder` exige solo `enabled`.
- Insertar fila de operador (`enabled=true`, cuenta null) para el user_id de ese correo vía inserción de datos, no en migración versionada con correo.
- `getPeyWebhookSecret` sin cambios. Actualizar docs/configuracion.md y AGENTS.md.
- Verificar con vitest, luego `security--get_scan_results`, `publish_settings--update_visibility` (público) y `preview_ui--publish`.
