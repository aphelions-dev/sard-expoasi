# Simulador de la malla

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/simulador` · **Lenguaje:** Python 3.12+, sin
dependencias (solo `pytest` para las pruebas), con [uv](https://docs.astral.sh/uv/).

## Cómo correrlo

Desde `simulador/`:

```bash
uv sync
PYTHONUTF8=1 uv run python -m simulador generar --n 20 --semilla 1        # reportes SARD1 sintéticos
PYTHONUTF8=1 uv run python -m simulador correr --semilla 1                 # malla con central simulada
PYTHONUTF8=1 uv run python -m simulador correr --perdida 0.3 --pasarelas 2 # cualquier parámetro
PYTHONUTF8=1 uv run python -m simulador correr --central --velocidad 10    # API real, failover A → B
PYTHONUTF8=1 uv run python -m simulador correr --desde ../pruebas/resultados/<corrida>/parametros.json
PYTHONUTF8=1 uv run python -m simulador escenarios                         # E1–E4 de pruebas/escenarios.md
PYTHONUTF8=1 uv run python -m simulador escenarios-central                 # E4 central, E5, E6/E7 (levanta A y B)
PYTHONUTF8=1 uv run python -m simulador recorrido                          # demo de 8 pasos con visor web
PYTHONUTF8=1 uv run python -m simulador recorrido --celulares              # la demo: pasos 1 a 4 con la app
PYTHONUTF8=1 uv run pytest                                                 # pruebas
```

Cada corrida escribe en `pruebas/resultados/<nombre>/`: `parametros.json` (para repetirla),
`metricas.json`, `reportes.csv` (qué le pasó a cada reporte) y `resumen.md`.

## Qué modela

Pasos de 1 s simulado. Con la central simulada, misma semilla y mismos parámetros dan el mismo
resultado exacto.

- **Celulares** repartidos al azar en un cuadrado alrededor del centro de Manizales; cada reporte
  lleva el geohash real de su celular (o vacío si no hay GPS, 10 %). Quietos.
- **Batería**: arranca entre 5 y 20 % (las bases: menos del 20 %), gasta en reposo y por cada
  mensaje emitido; en 0 el celular se apaga y lo que guardaba se pierde con él.
- **Bluetooth**: alcance fijo; cada mensaje en cada salto se pierde con probabilidad `perdida`.
- **Guardar y reenviar**: cada celular guarda los reportes que oye y los reenvía, **P1/P2
  primero** (luego por hora), hasta `capacidad` mensajes por segundo. P3/P4 nunca se descartan:
  esperan su turno.
- **Reintentos** con espera creciente hasta ver el `SACK`, y **vencimiento** a los 600 s de la
  `hora_unix` (contrato, reglas 2 y 5): vencido, el reporte se marca "no entregado" y deja de
  reintentarse, sin borrarse. La reactivación al aparecer un vecino nuevo (definida en #90) no se
  modela: con los celulares quietos y sin celulares que lleguen, nunca aparece un vecino nuevo y un
  celular aislado nunca gana camino. La reactivación la prueba la app (`ColaTest`, `app/README.md`).
- **Pasarela**: sube lo que tiene a la central; con el `SACK`, lo difunde de vuelta por la malla.
  Si un vecino sigue reenviando algo ya confirmado, se le repite el `SACK`.
- **Central**: simulada (acepta cada id una vez, cuenta duplicados, se puede "caer" con
  `--caida desde,hasta`) o la real con `--central` (`POST /reportes`, failover A → B por
  `GET /salud`; URLs en `CENTRAL_A_URL` y `CENTRAL_B_URL`).
- **Reportes**: el generador (#4) toma texto, tipo y banderas de atrapados y heridos de los 100
  reportes etiquetados (`datos/sinteticos/reportes_etiquetados.csv`). La prioridad del mensaje la
  calculan las reglas del celular (`simulador/reglas.py`, contrato «Prioridad en el celular»), como
  la app; la etiqueta del CSV queda como la verdad contra la que se mide el triaje (E6/E7).

## Recorrido de la demo

`python -m simulador recorrido` corre los 8 pasos de `docs/pitch/guion-demo.md` con la malla
simulada y las centrales reales (que levanta y apaga), y sirve un visor en `http://localhost:8090`
(`simulador/visor/`, HTML/CSS/JS sin dependencias): celulares sobre el barrio, copias del reporte en
tenue, el camino que llegó a la pasarela en grueso, `SACK` de vuelta, centrales A/B y el paso actual.
Se avanza con Enter o con el botón del visor; `--seguido --pausa 6` avanza solo. Cómo se presenta:
el guion.

Con `--celulares` (#86), los pasos 1 a 4 los hacen los celulares de la app: el script no crea
reportes simulados, espera el primer `reporte_recibido` de la central A que no sea del simulador
(lo sube la pasarela del celular C) y sigue ese id en los pasos 4 a 6. La malla simulada arranca en
el paso 7, para la ráfaga. Al arrancar imprime las URL de las centrales para la pasarela del celular.

## Parámetros por defecto

| Parámetro | Valor | De dónde sale |
|-----------|-------|---------------|
| `nodos`, `pasarelas` | 30, 1 | — |
| `lado_m` | 150 m | ~10 vecinos por celular: malla conectada para la corrida base |
| `alcance_m` | 50 m | Decisión del equipo (P3) |
| `perdida` | 10 % | E1 la varía: 0/10/30/50 % |
| `reportes`, `ventana_s`, `duracion_s` | 40 en los primeros 600 s, hasta 1800 s | — |
| `capacidad` | 4 mensajes/s por celular | Supuesto del simulador |
| `bateria_min`–`bateria_max` | 5–20 % | Bases, escenario 1 |
| `gasto_reposo`, `gasto_envio` | 0,002 %/s, 0,02 %/mensaje | Supuesto del simulador |
| `espera_base_s`, `espera_tope_s`, `variacion` | 2, 4, 8, 16, 32 s y luego 60 s, ±20 % | Contrato, regla 2 (#58) |
| `vence_s` | 600 s desde la `hora_unix` | Contrato, regla 5 (#58); `None` = nunca vence |

## Métricas

Tasa de entrega a la central, confirmados al reportante, latencia por prioridad (p50, p95, máx),
saltos promedio, llegadas duplicadas y reportes creados por id en la central, vencidos, celulares
apagados, celulares con camino a una pasarela al empezar (para leer E2: si están en islas, no hay
reintento que valga), mensajes emitidos y bytes.

## No le toca

App Android y central (solo las consume).

## Tareas por hito

- **Hito 1:** simulador básico (#3) y generador de reportes sintéticos (#4). Hecho.
- **Hito 3:** 100 reportes etiquetados a mano (#13). Hecho.
- **Hito 4:** pruebas de `pruebas/escenarios.md` con métricas (#16). Hecho salvo E6 con Jev;
  resultados en `pruebas/resultados/README.md`.

## Terminado

Con una semilla y unos parámetros dados produce siempre el mismo resultado, y reporta tasa de
entrega, latencia por prioridad y duplicados.
