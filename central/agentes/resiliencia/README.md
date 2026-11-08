# Agente de resiliencia

**Hito:** 4 · **Ficha:** `docs/fichas-agentes/resiliencia.md`

## Alcance

Mantener la central B al día desde el registro de eventos para que la pasarela pueda cambiar de A a B sin perder reportes.

## No le toca

Decidir el failover: lo decide la pasarela con `GET /salud`.

## Mecanismo

Cada segundo pide a la otra central `GET /eventos?desde_seq=` y une los eventos a su registro por id, en
las dos direcciones (`sincronizar.py`). Si la otra central deja de responder, registra `par_caido`; al
volver, `par_recuperado`.
