# Demo, pruebas y evidencia

[Volver al README](../README.md)

## Recorrido sin dinero real

1. Abre la pantalla principal y utiliza el chat del **negocio**.
2. Inicia el registro, indica el nombre y abre «Vincular cuenta demo».
3. Confirma que es una cuenta ficticia, vuelve al chat y utiliza el control de activación de demo.
4. Escribe `cobrar`; introduce `350`, el concepto `Servicio de prueba`, elige `anticipo` y total `1000`.
5. Revisa el resumen y escribe `confirmar`.
6. Utiliza «Compartir con cliente demo», entra al chat del **cliente** y abre «Abrir banco simulado».
7. Autoriza el pago simulado. Debe mostrar $350 recibidos y $650 de saldo; no implica reserva en una agenda externa.
8. Utiliza «Repetir evento de pago». No debe aparecer otro pago ni otra celebración por esa entrega repetida.

La demo acepta montos de $1 a $10,000 MXN; ese rango **no** aplica al flujo real, que solo permite $0.01 MXN. Nunca escanees el QR demo esperando un cobro bancario.

### Otros escenarios demo

| Acción | Resultado esperado |
| --- | --- |
| Rechazar en banco simulado | Intento rechazado; cobro pendiente y opción de volver a intentar |
| Vencer en banco simulado | Intento vencido; cobro pendiente |
| Pagar un cobro ya pagado | Mensaje indicando que no necesita otro pago |
| Cancelar el borrador antes de confirmar | No crea el cobro |

## Pruebas automatizadas existentes

```sh
bunx vitest run src/lib/pey/domain.test.ts src/lib/pey/experience.test.ts src/lib/pey/live-orders.test.ts src/lib/pey/live-webhooks.test.ts src/lib/pey/live-inbox.test.ts
```

| Archivo | Qué cubre |
| --- | --- |
| `domain.test.ts` | Conversión y rango de importes de demo |
| `experience.test.ts` | Cuenta regresiva y celebración sin repetición |
| `live-orders.test.ts` | Límite de un centavo, consentimiento e identificadores requeridos |
| `live-webhooks.test.ts` | Firmas Pey/Kapso, alteración de cuerpo y límite de tamaño |
| `live-inbox.test.ts` | Rechazo de peticiones sin firma y configuración faltante |

Son pruebas de validación y de límites del receptor. No ejecutan un pago bancario, no verifican todas las políticas de acceso y no prueban concurrencia de la función SQL de conciliación.

## Prueba real de aceptación — pendiente

Solo después de completar [configuración](configuracion.md), con el dueño habilitado y su consentimiento:

1. Inicia sesión y comprueba los indicadores del panel.
2. Crea **un** pedido por $0.01 MXN; conserva el identificador del pedido.
3. Comprueba que se guarda el identificador del QR Pey, se muestra el QR real y el pedido está `PENDING`.
4. Paga desde un banco compatible; una captura de comprobante no autoriza preparar el pedido.
5. Comprueba la notificación firmada, la transacción y la coincidencia de cuenta, QR e importe.
6. Lee de nuevo el pedido en la pantalla: debe estar «Listo para preparar» (`READY`).
7. Si el proveedor permite reenviar **la misma entrega**, verifica que no se crea otro pedido, otra transacción ni otra transición. No generar otro pago para simular un duplicado.

### Matriz de integración por verificar

| Escenario | Resultado del código esperado | Evidencia pendiente |
| --- | --- | --- |
| Pago coincidente en ventana | `READY`, HTTP 200 | Banco, Pey y lectura en pantalla |
| Misma transacción aplicada de nuevo | `DUPLICATE`, HTTP 200 | Reenvío y estado sin cambios |
| Fecha pagada fuera de ventana | `REVIEW`, HTTP 200 | Prueba controlada de conciliación sin nuevos cargos |
| Cuenta o importe incorrectos | Sin preparación; `INVALID` o fallo de validación | Prueba de integración aislada |
| QR no encontrado | `UNMATCHED`, HTTP 503 | Prueba de integración aislada |
| Otra transacción para pedido ya conciliado | `CONFLICT`, HTTP 503 | Prueba de integración aislada |
| Dos solicitudes con mismo dueño/requestId | Un pedido y un reclamo de creación | Prueba concurrente |
| Fallo de red tras solicitar QR | Revisión; no reintento automático | Prueba de fallo aislada |
| Evento antes de guardar identificador QR | No encontrado; necesita nueva entrega/revisión | Prueba de carrera aislada |

No enviar eventos falsificados a producción ni usar claves reales en pruebas unitarias. Las reglas SQL y escenarios concurrentes requieren un entorno aislado; esta tabla no declara que esas pruebas estén realizadas.

## Registro de evidencia para la entrega

| Evidencia | Estado |
| --- | --- |
| Recorrido demo navegador escritorio/móvil | Verificado previamente; volver a grabar para entregar |
| Suite automatizada | Reproducible con el comando anterior |
| QR real emitido para esta versión | Pendiente |
| Pago real de $0.01 MXN conciliado | Pendiente |
| Reenvío real sin doble efecto | Pendiente |
| Mensaje real enviado por Kapso | Pendiente |

Para cada prueba real registrar fecha y hora, entorno, pedido, resultado, respuesta y evidencia visual **redactada**. Ocultar datos bancarios, correos, teléfonos, tokens, cabeceras firmadas y QR pagables. No reutilizar como propia la evidencia del repositorio de referencia.