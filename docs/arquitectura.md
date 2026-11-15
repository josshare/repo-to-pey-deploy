# Arquitectura y diagramas

[Volver al README](../README.md)

## 1. Componentes y separación de entornos

```mermaid
flowchart TB
    subgraph Browser[Navegador]
        Demo[Chats y banco simulados]
        Owner[Panel del dueño autenticado]
        Visual[QR, cuenta regresiva y celebración]
    end
    subgraph Server[Servidor TanStack Start]
        DemoFn[Funciones de demo]
        Engine[Motor de conversación simulado]
        LiveFn[Funciones de pedidos reales]
        Gateway[Conexión privada mediante gateway]
        Receiver[Receptores públicos con verificación de firma]
        Reconcile[Conciliación de pedido]
    end
    subgraph Cloud[Lovable Cloud]
        DemoDB[Datos de demo aislados por sesión]
        Access[Operadores habilitados]
        LiveDB[Pedidos reales]
        Inbox[Bandeja de eventos reales]
    end
    Demo --> DemoFn --> Engine --> DemoDB
    Demo --> Visual
    Owner --> LiveFn
    LiveFn --> Access
    LiveFn --> LiveDB
    LiveFn --> Gateway --> Pey[Pey]
    Pey --> Receiver
    Kapso[Kapso: procesamiento pendiente] --> Receiver
    Receiver --> Inbox
    Receiver --> Reconcile --> LiveDB
```

- **Demo:** sesión anónima mediante cookie `pey_demo` httpOnly; las funciones de servidor comprueban la sesión y el alcance de sus datos. No hay acceso público directo a esas tablas.
- **Pedidos reales:** requieren sesión del dueño y registro habilitado en `live_payment_operators`. La cuenta receptora se toma del servidor, no de un campo editable por el visitante.
- **Conexiones:** claves privadas solo en servidor, con gateway de conexiones. La demo no realiza llamadas reales a proveedores.
- **Notificaciones:** Pey y Kapso tienen receptores separados; la bandeja de eventos reales nunca cambia los cobros de demo.
- **Acción implementada:** actualizar el pedido a `READY`. No hay envío a cocina, entrega, mensaje Kapso ni reserva de agenda como efecto de esa transición.

## 2. Secuencia de un pedido real preparado

```mermaid
sequenceDiagram
    actor Owner as Dueño habilitado
    participant App as Aplicación
    participant DB as Lovable Cloud
    participant Gateway as Gateway privado
    participant Pey as Pey
    actor Customer as Cliente / banco
    Owner->>App: Concepto, requestId y consentimiento para 0.01 MXN
    App->>DB: Verificar operador y cuenta receptora
    App->>DB: Guardar pedido único por dueño y requestId
    App->>DB: Reclamar DRAFT a CREATING
    alt Solicitud ya reclamada
        App-->>Owner: Devolver pedido existente sin crear otro QR
    else Primera solicitud
        App->>Gateway: Solicitar QR, sin reintento automático
        Gateway->>Pey: Crear QR de 0.01 MXN, vigencia 600 segundos
        alt QR recibido y guardado
            Pey-->>App: Identificador y qrString mediante gateway
            App->>DB: PENDING y vencimiento
            App-->>Owner: Mostrar QR
            Customer->>Pey: Pago mediante el banco
            Pey->>App: Evento codi.qr.payment_received firmado
            App->>App: Verificar firma y validar cuerpo
            App->>DB: Guardar entrega única
            App->>DB: Conciliar bajo bloqueo del pedido
            alt Pago coincidente dentro de la ventana
                DB-->>App: READY
                App-->>Pey: HTTP 200
                Owner->>App: Consultar pedidos
                App-->>Owner: Listo para preparar
            else Transacción ya aplicada
                DB-->>App: DUPLICATE, sin nueva transición
                App-->>Pey: HTTP 200
            else Fecha fuera de la ventana
                DB-->>App: REVIEW
                App-->>Pey: HTTP 200, requiere revisión
            else Evento inválido, no encontrado o en conflicto
                DB-->>App: INVALID / UNMATCHED / CONFLICT
                App-->>Pey: HTTP 503, no preparar
            end
        else Error o resultado incierto al crear QR
            App->>DB: Intentar marcar REVIEW
            App-->>Owner: Error, no repetir el cobro
        end
    end
```

El panel vuelve a consultar pedidos cada cinco segundos mientras hay sesión. No hay canal de tiempo real ni cola de trabajos; los eventos se procesan de forma síncrona. Si falla guardar el estado de revisión, el pedido puede permanecer en `CREATING`: también exige revisión manual.

## 3. Estados persistidos de pedidos reales

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Pedido guardado
    DRAFT --> CREATING: Reclamo exclusivo
    CREATING --> PENDING: QR recibido y guardado
    CREATING --> REVIEW: Fallo o incertidumbre
    PENDING --> READY: Pago válido en ventana
    PENDING --> REVIEW: Pago con fecha fuera de ventana
    READY --> READY: Misma transacción, DUPLICATE
    REVIEW --> REVIEW: Misma transacción registrada, DUPLICATE
```

`QR vencido` es una indicación de pantalla, **no** otro estado de base de datos. Sin evento recibido, un pedido vencido sigue en `PENDING`. `READY` expresa pago conciliado y permiso para preparar; no prueba preparación o entrega física. No existe un estado persistido separado `PAID` en pedidos reales.

## 4. Modelo de datos del flujo real

```mermaid
erDiagram
    LIVE_PAYMENT_OPERATORS ||--o{ LIVE_ORDERS : "autoriza al propietario, relacion logica"
    LIVE_PAYMENT_OPERATORS {
        uuid user_id PK
        text bank_account_id
        boolean enabled
    }
    LIVE_ORDERS {
        uuid id PK
        uuid owner_id
        uuid request_id "unico junto con owner_id"
        integer amount_cents "fijo en 1"
        text concept
        text bank_account_id
        text status
        text provider_qr_id UK
        text qr_string
        text transaction_id UK
        timestamptz expires_at
        timestamptz paid_at
    }
    LIVE_PROVIDER_EVENTS {
        uuid id PK
        text provider "unico junto con delivery_id"
        text delivery_id
        text event_type
        jsonb payload
        timestamptz processed_at
        text processing_error
    }
```

La relación operador/pedido es lógica; no declara una llave foránea en la migración. La bandeja no tiene una relación física con pedidos: la conciliación cruza `codiQrId` con `provider_qr_id`. Las restricciones únicas de QR y transacción impiden asignar esos identificadores a dos pedidos.

La demo utiliza `demo_runs`, `merchants`, `bank_accounts`, `onboarding_sessions`, `conversations`, `messages`, `charges`, `payment_attempts`, `payments` y `webhook_events`; no reutiliza tablas reales.

## 5. Mapa del código

| Área | Archivo |
| --- | --- |
| Pantalla principal y vinculación ficticia | `src/routes/index.tsx`, `src/routes/vincular.tsx` |
| Panel real del dueño | `src/components/live-orders-panel.tsx` |
| Presentación de QR y celebración | `src/components/payment-experience.tsx` |
| Funciones y motor demo | `src/lib/pey/demo.functions.ts`, `engine.server.ts` |
| Validación del pedido y evento Pey | `src/lib/pey/live-orders.ts` |
| Acceso y creación del pedido | `src/lib/pey/live-orders.functions.ts` |
| Solicitud de QR y llamada a conciliación | `src/lib/pey/live-orders.server.ts` |
| Verificación y bandeja de eventos | `src/lib/pey/live-webhooks.ts`, `live-inbox.server.ts` |
| Receptores HTTP | `src/routes/api/public/pey/webhook.ts`, `src/routes/api/public/kapso/webhook.ts` |
| Tablas y conciliación atómica | `drizzle/migrations/0001_create_live_provider_inbox.sql`, `0002_prepare_live_pey_orders.sql` |

Los diagramas documentan la implementación actual, no la arquitectura NestJS ni Python de los repositorios de origen/referencia.