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
(cd tablero && npm install && npm run dev -- -p 5173)              # terminal 1: tablero → http://localhost:5173
cd simulador && uv sync && PYTHONUTF8=1 uv run python -m simulador recorrido   # terminal 2: el recorrido
```

El recorrido levanta las centrales A y B, abre el visor de la malla (`http://localhost:8090`) y avanza
por los 8 pasos de la condición de integración (Enter o «Siguiente paso»): reporte, almacenamiento,
transmisión, agentes, priorización, aprobación en el tablero, **caída de la central A en plena carga**
y recuperación. Sin `JEV_API_KEY` el triaje corre solo con reglas; con ella, copiar `.env.example` a
`.env` y agregar `--env-file ../.env`. Guion y plan B de cada paso: `docs/pitch/guion-demo.md`.

### App Android

**APK:** release [`app-v1.1`](https://github.com/aphelions-dev/sard-expoasi/releases/tag/app-v1.1)
(`app-arm64-v8a-debug.apk`), con el estilo del tablero. Si ya tienes la
[`app-v1.0`](https://github.com/aphelions-dev/sard-expoasi/releases/tag/app-v1.0), desinstálala antes porque tiene otra firma. Es un fork de bitchat con el botón SOS, prioridad por reglas, cola de
reenvío por Bluetooth y modo pasarela con failover A → B. Probado con 3 celulares: un reporte creado
sin internet llega a la central y el reportante ve «entregado». Cómo preparar la demo con celulares:
[`app/README.md`](app/README.md#demo-con-celulares-hito-5).

### Con Docker, sin instalar nada más

Requisito: Docker. Levanta las centrales A y B con sus agentes y el tablero, cada central con su
propio volumen para el registro de eventos:

```bash
docker compose up --build -d          # centrales en :8001 y :8002, tablero en http://localhost:5173
docker compose run --rm simulador     # carga reportes sintéticos por la malla simulada
docker compose stop central-a         # condición adversa: cae la A y el tablero sigue con la B
docker compose start central-a        # vuelve la A y trae lo que hizo la B
docker compose down -v                # apaga todo y borra los registros
```

Con `JEV_API_KEY` en `.env` el triaje usa Jev; sin ella, solo reglas.

## Entregables

| # | Entregable | Dónde | Estado |
|---|------------|-------|--------|
| 1 | Prototipo funcional | `central/`, `tablero/`, `simulador/`, `app/` | Central, agentes, tablero y malla simulada funcionando de punta a punta. App Android (fork de bitchat) probada con 3 celulares; APK en el release [`app-v1.1`](https://github.com/aphelions-dev/sard-expoasi/releases/tag/app-v1.1). |
| 2 | Código fuente | Este repo; cómo instalar y correr cada parte en `central/README.md`, `tablero/README.md` y `simulador/README.md` | Listo |
| 3 | Documento de arquitectura | [`docs/entregables/03-arquitectura.md`](docs/entregables/03-arquitectura.md), decisiones en `docs/decisiones/` | Listo |
| 4 | Fichas de agentes | [`docs/entregables/04-fichas-agentes.md`](docs/entregables/04-fichas-agentes.md), una por agente en `docs/fichas-agentes/` | Listo |
| 5 | Protocolo de comunicación | [`docs/entregables/05-protocolo-comunicacion.md`](docs/entregables/05-protocolo-comunicacion.md); el contrato en `contracts/` | Listo; por definir con la app: largo máximo del texto y antigüedad del GPS |
| 6 | Resultados de pruebas | [`docs/entregables/06-resultados-pruebas.md`](docs/entregables/06-resultados-pruebas.md); datos en `pruebas/resultados/` | E1 a E7 con métricas, estrés, errores observados y limitaciones |
| 7 | Pitch y demostración | [`docs/pitch/pitch.pdf`](docs/pitch/pitch.pdf), guion en `docs/pitch/guion-demo.md` | Presentación de 9 diapositivas, recorrido de 8 pasos con la caída de la central A y video de respaldo (`docs/pitch/sard-demo-respaldo.mp4`) |

## Resultados clave

- **0 reportes perdidos** al apagar la central A completa en plena carga (60 de 60); la pasarela pasó
  a la B.
- **Un P1 llega 5 veces más rápido** con la cola llena gracias a la prioridad (5,4 s contra 26,5 s), sin
  descartar P3/P4.
- **99,8 % de entrega** aunque se pierda la mitad de los mensajes en cada salto.
- **Un reporte por id** en la central aunque llegue por 3 pasarelas.
- **Con Jev, ningún P1 queda por debajo** (recall de P1 de 100 % en 100 reportes etiquetados, contra
  87 % solo con reglas), y nunca baja la prioridad del celular.
- **Sin Jev, el triaje sigue**: prioriza 100 reportes en 2,2 s solo con reglas.

Detalle, hallazgos y cómo repetir cada prueba: [entregable 6](docs/entregables/06-resultados-pruebas.md).

## Qué hay en el repo

| Carpeta | Qué es | Dueño |
|---------|--------|-------|
| `contracts/` | Protocolo SARD1, API de la central y palabras críticas. Único punto de unión. | Los tres |
| `app/` | App Android (fork de bitchat): formulario, malla, pasarela | Persona 1 |
| `central/` | API, registro de eventos solo-agregar, agentes, central B | Persona 2 |
| `tablero/` | Tablero del coordinador (Next.js) con mapa por barrio | Persona 3 |
| `reportar/` | App web de reportes para celulares sin la app Android (ADR 0007 y 0008) | Persona 3 |
| `simulador/` | Simulador de la malla, pruebas E1–E7 y recorrido de la demo | Persona 3 |
| `datos/sinteticos/` | 100 reportes sintéticos etiquetados a mano | Persona 3 |
| `pruebas/` | Escenarios y resultados | Persona 3 |
| `docs/` | Entregables, decisiones, fichas de agentes, uso responsable de IA, despliegue, pitch | Los tres |

Uso responsable de la IA: `docs/uso-responsable-ia.md`. Riesgos y planes B: `docs/riesgos.md`.

## Limitaciones conocidas

- La app se probó con 3 celulares; las pruebas de escala (decenas de celulares, pérdida, batería)
  se hacen con el simulador, que modela la malla pero no reemplaza una prueba de campo.
- Las reglas no interpretan negaciones («no hay atrapados» sube a P1, con aviso de posible
  negación); sin Jev, 4 de 30 casos críticos sin palabra crítica dependen del coordinador (con Jev,
  ninguno).
- Todos los datos son sintéticos.

## Equipo

Persona 1 **@samcastroca** (app y malla) · Persona 2 **@lufigir** (central y agentes) · Persona 3
**@CrArenas** (tablero, simulador y pruebas). Qué hace cada uno y cómo trabajamos (ramas, commits,
issues): [`docs/equipo.md`](docs/equipo.md).

## Documentación

| Tema | Documentos |
|------|------------|
| Contrato | [Protocolo SARD1](contracts/protocolo-sard1.md) · [API de la central](contracts/api-central.md) · [Ejemplos](contracts/ejemplos/README.md) |
| Entregables | [Índice y verificación contra las bases](docs/entregables/README.md) · [3. Arquitectura](docs/entregables/03-arquitectura.md) · [4. Fichas de agentes](docs/entregables/04-fichas-agentes.md) · [5. Protocolo](docs/entregables/05-protocolo-comunicacion.md) · [6. Resultados de pruebas](docs/entregables/06-resultados-pruebas.md) |
| Decisiones | [ADR 0001](docs/decisiones/0001-usar-port-android-bitchat.md) · [0002](docs/decisiones/0002-solo-android.md) · [0003](docs/decisiones/0003-registro-eventos-solo-agregar.md) · [0004](docs/decisiones/0004-jev-solo-en-central.md) · [0005](docs/decisiones/0005-reglas-ganan-palabra-critica.md) · [0006](docs/decisiones/0006-recursos-por-unidad-sci.md) · [0007](docs/decisiones/0007-ios-relevo-y-app-web.md) · [0008](docs/decisiones/0008-reportar-aparte-y-railway.md) |
| Fichas de agentes | [Recepción](docs/fichas-agentes/recepcion.md) · [Triaje](docs/fichas-agentes/triaje.md) · [Correlación](docs/fichas-agentes/correlacion.md) · [Coordinación](docs/fichas-agentes/coordinacion.md) · [Resiliencia](docs/fichas-agentes/resiliencia.md) · [Comunicación](docs/fichas-agentes/comunicacion.md) · [Plantilla](docs/fichas-agentes/_plantilla.md) |
| Pruebas | [Escenarios](pruebas/escenarios.md) · [Resultados](pruebas/resultados/README.md): [E1](pruebas/resultados/E1/resumen.md) · [E2](pruebas/resultados/E2/resumen.md) · [E3](pruebas/resultados/E3/resumen.md) · [E4](pruebas/resultados/E4/resumen.md) ([central](pruebas/resultados/E4/resumen-central.md)) · [E5](pruebas/resultados/E5/resumen-central.md) · [E6](pruebas/resultados/E6/resumen-central.md) · [E7](pruebas/resultados/E7/resumen-central.md) · [Base S1](pruebas/resultados/base-s1/resumen.md) |
| Proyecto | [Plan por hitos](docs/plan.md) · [Despliegue](docs/despliegue.md) · [Riesgos](docs/riesgos.md) · [Uso responsable de la IA](docs/uso-responsable-ia.md) · [Cómo trabajamos](docs/equipo.md) |
| Demo y pitch | [Guion de la demo](docs/pitch/guion-demo.md) · [Pitch](docs/pitch/README.md) |
| Por área | [App](app/README.md) · [Central](central/README.md) · [Tablero](tablero/README.md) · [Simulador](simulador/README.md) · [Datos sintéticos](datos/sinteticos/README.md) |
| Referencias | [Bases de la hackathon (PDF)](docs/referencias/HackathonExpoASI2026.pdf) · [Investigación de la central](docs/referencias/investigacion-central.md) |
