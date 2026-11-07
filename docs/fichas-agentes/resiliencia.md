# Ficha: agente de resiliencia

| Campo | Contenido |
|-------|-----------|
| Objetivo | Mantener la central B al día desde el registro de eventos para que la pasarela pueda cambiar de A a B sin perder reportes. |
| Entradas | Registro de eventos de la central A. |
| Salidas | Central B con el mismo registro; estado en `GET /salud`. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Decidir el failover (lo decide la pasarela). Mecanismo de sincronización: por definir. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
