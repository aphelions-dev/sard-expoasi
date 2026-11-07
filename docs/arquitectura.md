# Arquitectura

```
[Reportante]  --BT-->  [Relevo]  --BT-->  [Pasarela]  --HTTP-->  [Central A | B]  -->  [Tablero]  <-- Coordinador
 Android sin red       Android sin red    Android con red        agentes + registro       aprueba acciones
        <------------------------- SACK ---------------------------
```

## 1. Malla Android (reportante y relevo)

- Fork de bitchat Android, Bluetooth LE, sin internet.
- El reportante crea el reporte, calcula la prioridad **con reglas** y lo guarda localmente.
- Cada nodo guarda y reenvía por prioridad (P1/P2 primero, sin descartar P3/P4) y reintenta con
  espera creciente hasta ver `SACK`.

## 2. Pasarela Android

- Mismo build, con internet.
- Sube los mensajes SARD1 con `POST /reportes`; usa `GET /salud` para elegir central A o B.
- Devuelve los `SACK` a la malla.

## 3. Central con agentes

- API (`contracts/api-central.md`) y **registro de eventos solo-agregar**.
- Agentes: recepción → triaje (reglas + Jev) → correlación → coordinación; resiliencia mantiene
  la central B sincronizada.
- Jev solo aquí. Si falla, triaje sigue con reglas. Jev nunca baja prioridades.

## 4. Coordinador humano

- Tablero con incidentes priorizados, evidencia e incertidumbre.
- Ninguna acción se ejecuta sin su aprobación.

## 5. Agentes y sincronización de la central

- Cada agente es un proceso aparte sobre el registro de eventos (patrón pizarra): recepción
  (dentro de la API), triaje, correlación, coordinación y resiliencia. No hay orquestador; si
  uno cae, los demás siguen y al volver retoma lo pendiente.
- Flujo de eventos: `reporte_recibido` → `reporte_priorizado` → `incidente_actualizado` →
  `accion_propuesta` → `decision_humana`.
- Las centrales A y B corren a la vez y se copian los eventos en las dos direcciones
  (`GET /eventos`), uniéndolos por id: el registro es un conjunto que solo crece, sin conflictos.
  Los agentes de la B esperan mientras la A responda; si la A cae, la B toma el relevo. Detalle
  en `central/README.md` y `docs/fichas-agentes/resiliencia.md`.

## Por definir

- Stack del tablero.
- Cómo se elige el rol de cada celular.
