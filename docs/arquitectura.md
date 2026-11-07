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

## Por definir

- Stack del tablero.
- Mecanismo de sincronización A → B.
- Cómo se elige el rol de cada celular.
