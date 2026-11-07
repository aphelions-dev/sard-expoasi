# Agente de recepción

**Hito:** 2 · **Ficha:** `docs/fichas-agentes/recepcion.md`

## Alcance

Recibir los mensajes de `POST /reportes`, validar el formato SARD1, descartar duplicados por id, escribir en el registro de eventos y devolver `SACK`.

## No le toca

Triaje, correlación o cualquier interpretación del texto.
