# Simulador de la malla

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/tablero-pruebas` · **Lenguaje:** Python

## Qué modela

- N celulares con posición y alcance Bluetooth.
- Batería: un nodo se apaga cuando se agota.
- Una o más pasarelas con internet.
- Pérdida de paquetes configurable (0/10/30/50 %).
- Reenvío por prioridad, reintentos y `SACK` según `contracts/protocolo-sard1.md`.
- Opcional: envío real a la central por `POST /reportes`.

Parámetros exactos (alcance en metros, modelo de batería, movilidad): **por definir**.

## Alcance

Simulador, generador de reportes sintéticos y métricas para `pruebas/`.

## No le toca

App Android y central (solo las consume).

## Dependencias

- Contrato SARD1.
- API de la central para las pruebas de punta a punta.
- Plan B del Hito 1: si la malla real no funciona, el simulador hace de transporte.

## Tareas por hito

- **Hito 1:** simulador básico y generador de reportes sintéticos.
- **Hito 3:** 100 reportes etiquetados a mano en `datos/sinteticos/reportes_etiquetados.csv`.
- **Hito 4:** pruebas de `pruebas/escenarios.md` con métricas.

## Terminado

Con una semilla y unos parámetros dados produce siempre el mismo resultado, y reporta tasa de
entrega, latencia por prioridad y duplicados.
