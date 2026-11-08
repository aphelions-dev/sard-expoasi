# Agente de correlación

**Hito:** 3 · **Ficha:** `docs/fichas-agentes/correlacion.md`

## Alcance

Agrupar reportes del mismo evento (geohash cercano, tipo, ventana de tiempo) en un incidente con su evidencia.

## No le toca

Cambiar prioridades ni proponer acciones.

## Criterios

Candidatos: incidentes con reportes a menos de 1,5 km y 2 h (máximo 5). Jev dice por cada uno si es el
mismo suceso y si lo contradice; con p ≥ 0,7 se vincula y entre 0,3 y 0,7 queda como posible vínculo.
Sin Jev solo se junta la misma celda de geohash, el mismo tipo y menos de 30 min. Umbrales en `jev.py`.
