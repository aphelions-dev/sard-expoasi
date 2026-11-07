# SARD — Sistema Agéntico de Respuesta y Resiliencia ante Desastres

Hackathon SARD, UNAL Manizales, 2026. Escenario: sismo de 7,4 y apagón general en la región andina
(bases en `docs/referencias/HackathonExpoASI2026.pdf`).

Un reporte de emergencia hecho **sin internet** viaja de celular en celular por una malla Bluetooth
hasta un celular **pasarela** que lo sube a una **central de riesgo**. Allí, agentes lo validan,
priorizan y agrupan con otros del mismo suceso, y un **coordinador humano** lo ve en un tablero con
su evidencia e incertidumbre y aprueba la acción. Si la central principal se cae, la pasarela pasa a
la central B, que ya tiene todo sincronizado.

> **Reglas en el borde, Jev en el centro, humanos al final.** El celular prioriza con reglas; Jev
> (TypeSafe AI) solo corre en la central y nunca baja una prioridad; ninguna acción se ejecuta sin
> aprobación humana.

## La demo en tres comandos

Requisitos: Python 3.12+ con [uv](https://docs.astral.sh/uv/) y Node 20+. Puertos libres: 8001,
8002, 8090 y 5173.

```bash
git clone https://github.com/aphelions-dev/sard-expoasi.git && cd sard-expoasi
(cd tablero && npm install && npm run dev)                          # terminal 1: tablero → http://localhost:5173
cd simulador && uv sync && PYTHONUTF8=1 uv run python -m simulador recorrido   # terminal 2: el recorrido
```

El recorrido levanta las centrales A y B, abre el visor de la malla (`http://localhost:8090`) y avanza
por los 8 pasos de la condición de integración (Enter o «Siguiente paso»): reporte, almacenamiento,
transmisión, agentes, priorización, aprobación en el tablero, **caída de la central A en plena carga**
y recuperación. Sin `JEV_API_KEY` el triaje corre solo con reglas; con ella, copiar `.env.example` a
`.env` y agregar `--env-file ../.env`. Guion y plan B de cada paso: `docs/pitch/guion-demo.md`.

## Entregables

| # | Entregable | Dónde | Estado |
|---|------------|-------|--------|
| 1 | Prototipo funcional | `central/`, `tablero/`, `simulador/`, `app/` | Central, agentes, tablero y malla simulada funcionando de punta a punta. La app Android (fork de bitchat) está en curso. |
| 2 | Código fuente | Este repo; cómo instalar y correr cada parte en `central/README.md`, `tablero/README.md` y `simulador/README.md` | Listo |
| 3 | Documento de arquitectura | `docs/arquitectura.md`, decisiones en `docs/decisiones/` | Listo |
| 4 | Fichas de agentes | `docs/fichas-agentes/` | Listo; la de comunicación (app) tiene campos por definir |
| 5 | Protocolo de comunicación | `contracts/protocolo-sard1.md`, `contracts/api-central.md`, ejemplos en `contracts/ejemplos/` | Listo; por definir con la app: largo máximo del texto, vencimiento y tiempos de reintento |
| 6 | Resultados de pruebas | `pruebas/resultados/README.md` | E1–E5 y E7 con métricas, estrés, errores observados y limitaciones. E6 (triaje con Jev) pendiente de la clave |
| 7 | Pitch y demostración | `docs/pitch/` | Presentación v1 (el PDF se agrega al aprobarla) y recorrido de 8 pasos ensayado con una condición adversa. Video de respaldo pendiente |

## Resultados clave

- **0 reportes perdidos** al apagar la central A completa en plena carga (60 de 60); la pasarela pasó
  a la B.
- **Un P1 llega 4 veces más rápido** con la cola llena gracias a la prioridad (6,3 s contra 25,4 s), sin
  descartar P3/P4.
- **99,8 % de entrega** aunque se pierda la mitad de los mensajes en cada salto.
- **Un reporte por id** en la central aunque llegue por 3 pasarelas.
- **Sin Jev, el triaje sigue**: prioriza 100 reportes en 4,2 s y nunca baja la prioridad del celular.

Detalle, hallazgos y cómo repetir cada prueba: `pruebas/resultados/README.md`.

## Qué hay en el repo

| Carpeta | Qué es | Dueño |
|---------|--------|-------|
| `contracts/` | Protocolo SARD1, API de la central y palabras críticas. Único punto de unión. | Los tres |
| `app/` | App Android (fork de bitchat): formulario, malla, pasarela | Persona 1 |
| `central/` | API, registro de eventos solo-agregar, agentes, central B | Persona 2 |
| `tablero/` | Tablero del coordinador (React) con mapa por barrio | Persona 3 |
| `simulador/` | Simulador de la malla, pruebas E1–E7 y recorrido de la demo | Persona 3 |
| `datos/sinteticos/` | 100 reportes sintéticos etiquetados a mano | Persona 3 |
| `pruebas/` | Escenarios y resultados | Persona 3 |
| `docs/` | Arquitectura, decisiones, fichas de agentes, uso responsable de IA, pitch | Los tres |

Uso responsable de la IA: `docs/uso-responsable-ia.md`. Riesgos y planes B: `docs/riesgos.md`.

## Limitaciones conocidas

- La malla se muestra con el simulador mientras la app Android no esté lista; el simulador modela
  alcance, pérdida y batería, pero no reemplaza la prueba con celulares.
- Las reglas de triaje tienen falsos positivos y variantes que no detectan (#43); sin Jev, 13 de 30
  casos críticos sin palabra crítica dependen del coordinador.
- Si la central A cae justo después de confirmar un reporte, la B lo recibe cuando la A vuelve (#49).
- Todos los datos son sintéticos.

## Equipo: qué hace cada uno

Antes de tocar nada, cada uno lee [`CLAUDE.md`](CLAUDE.md),
[`contracts/protocolo-sard1.md`](contracts/protocolo-sard1.md) y el README y el `CLAUDE.md` de su
carpeta. Comandos para clonar, cambiarse de rama y abrir Claude Code, más ramas, commits e issues:
[`docs/equipo.md`](docs/equipo.md). Hitos y tareas: [`docs/plan.md`](docs/plan.md).

| Integrante | Qué hace | Empieza por | Tareas |
|------------|----------|-------------|--------|
| **@samcastroca** (P1) · rama `p1/app-malla` | App Android sobre el fork de bitchat: formulario sin internet, prioridad por reglas, almacenamiento local, cola de reenvío con `SACK` y pasarela con failover A/B | [`app/README.md`](app/README.md) · [ficha de comunicación](docs/fichas-agentes/comunicacion.md) | [Issues abiertos](https://github.com/aphelions-dev/sard-expoasi/issues?q=is%3Aissue%20is%3Aopen%20assignee%3Asamcastroca) |
| **@lufigir** (P2) · rama `p2/central-agentes` | Central (API, registro de eventos solo-agregar, central B) y agentes de recepción, triaje, correlación, coordinación y resiliencia | [`central/README.md`](central/README.md) · [arquitectura](docs/arquitectura.md) | [Issues abiertos](https://github.com/aphelions-dev/sard-expoasi/issues?q=is%3Aissue%20is%3Aopen%20assignee%3Alufigir) |
| **@CrArenas** (P3) · rama `p3/tablero-pruebas` | Tablero del coordinador, simulador de la malla (plan B de la demo), reportes sintéticos, pruebas con métricas, README y pitch | [`tablero/README.md`](tablero/README.md) · [`simulador/README.md`](simulador/README.md) · [resultados](pruebas/resultados/README.md) | [Issues abiertos](https://github.com/aphelions-dev/sard-expoasi/issues?q=is%3Aissue%20is%3Aopen%20assignee%3ACrArenas) |

Las tareas compartidas (recorrido integrado, ensayos de la demo, revisión del contrato) aparecen en
el filtro de cada uno.

## Documentación

| Tema | Documentos |
|------|------------|
| Contrato | [Protocolo SARD1](contracts/protocolo-sard1.md) · [API de la central](contracts/api-central.md) · [Ejemplos](contracts/ejemplos/README.md) |
| Arquitectura y decisiones | [Arquitectura](docs/arquitectura.md) · [ADR 0001](docs/decisiones/0001-usar-port-android-bitchat.md) · [0002](docs/decisiones/0002-solo-android.md) · [0003](docs/decisiones/0003-registro-eventos-solo-agregar.md) · [0004](docs/decisiones/0004-jev-solo-en-central.md) · [0005](docs/decisiones/0005-reglas-ganan-palabra-critica.md) |
| Fichas de agentes | [Recepción](docs/fichas-agentes/recepcion.md) · [Triaje](docs/fichas-agentes/triaje.md) · [Correlación](docs/fichas-agentes/correlacion.md) · [Coordinación](docs/fichas-agentes/coordinacion.md) · [Resiliencia](docs/fichas-agentes/resiliencia.md) · [Comunicación](docs/fichas-agentes/comunicacion.md) · [Plantilla](docs/fichas-agentes/_plantilla.md) |
| Pruebas | [Escenarios](pruebas/escenarios.md) · [Resultados](pruebas/resultados/README.md): [E1](pruebas/resultados/E1/resumen.md) · [E2](pruebas/resultados/E2/resumen.md) · [E3](pruebas/resultados/E3/resumen.md) · [E4](pruebas/resultados/E4/resumen.md) ([central](pruebas/resultados/E4/resumen-central.md)) · [E5](pruebas/resultados/E5/resumen-central.md) · [E7](pruebas/resultados/E7/resumen-central.md) · [Base S1](pruebas/resultados/base-s1/resumen.md) |
| Proyecto | [Plan por hitos](docs/plan.md) · [Entregables](docs/entregables.md) · [Riesgos](docs/riesgos.md) · [Uso responsable de la IA](docs/uso-responsable-ia.md) · [Cómo trabajamos](docs/equipo.md) |
| Demo y pitch | [Guion de la demo](docs/pitch/guion-demo.md) · [Pitch](docs/pitch/README.md) |
| Por área | [App](app/README.md) · [Central](central/README.md) · [Tablero](tablero/README.md) · [Simulador](simulador/README.md) · [Datos sintéticos](datos/sinteticos/README.md) |
| Referencias | [Bases de la hackathon (PDF)](docs/referencias/HackathonExpoASI2026.pdf) · [Investigación de la central](docs/referencias/investigacion-central.md) |
