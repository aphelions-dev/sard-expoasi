# SARD — Sistema Agéntico de Respuesta y Resiliencia ante Desastres

Hackathon SARD, UNAL Manizales.

Los reportes de emergencia viajan de celular en celular por una malla Bluetooth (fork del port
Android de bitchat) hasta un celular **pasarela** con internet, que los sube a una **central de
riesgo**. Allí, agentes clasifican, deduplican y priorizan, y un **coordinador humano** los ve en
un tablero y aprueba las acciones.

> Principio: **reglas en el borde, Jev en el centro, humanos al final.**
> Jev (TypeSafe AI) solo corre en la central. Si Jev falla, el triaje sigue con reglas.

Plataforma: **solo Android** por ahora.

## Organización

| Carpeta | Qué es | Dueño |
|---------|--------|-------|
| `contracts/` | Protocolo SARD1 y API de la central. Único punto de unión. | Los tres |
| `app/` | App Android (fork de bitchat): formulario, malla, pasarela | Persona 1 |
| `central/` | API, registro de eventos, agentes, central B | Persona 2 |
| `tablero/` | Tablero del coordinador | Persona 3 |
| `simulador/` | Simulador de la malla en Python | Persona 3 |
| `datos/sinteticos/` | Reportes sintéticos etiquetados | Persona 3 |
| `pruebas/` | Escenarios y resultados | Persona 3 |
| `docs/` | Arquitectura, plan, ADRs, fichas de agentes, pitch | Los tres |

Integrantes: Persona 1 = **@samcastroca**, Persona 2 = **@lufigir**, Persona 3 = **@CrArenas**
(ver `.github/CODEOWNERS`).

## Cómo empezar

1. Leer este README, `CLAUDE.md` y `contracts/protocolo-sard1.md`.
2. Cambiarse a tu rama: `git switch p1/app-malla` (o `p2/central-agentes`, `p3/tablero-pruebas`).
3. Leer el README de tu carpeta y tus issues del hito actual (`docs/plan.md`).
4. Abrir Claude Code dentro de tu carpeta (`cd app && claude`).

## Cómo trabajamos

### Ramas

| Rama | Uso |
|------|-----|
| `main` | Solo versiones estables para la demo. Protegida. |
| `dev` | Integración. Protegida. |
| `p1/app-malla`, `p2/central-agentes`, `p3/tablero-pruebas` | Trabajo de cada persona, desde `dev`. |
| `contrato/<descripcion>` | Cualquier cambio a `contracts/`. Revisan los tres. |

### Integración

- Al terminar una tarea, PR de tu rama a `dev`. PRs chicos y frecuentes; no acumular.
- Antes de abrir el PR: `git fetch && git merge origin/dev` en tu rama.
- Al cumplirse un hito: PR `dev → main` y tag `hito-1` … `hito-5`.
- Cambios al contrato: nunca dentro de un PR de tu área; rama `contrato/...` aparte.

### Commits

En español, con prefijo: `feat`, `fix`, `docs`, `test`, `chore`, `contrato`.

```
feat: cola de reenvío por prioridad
contrato: definir escape de | en el texto
```

### Issues

Un issue por tarea de `docs/plan.md`, con milestone (`Hito N`), etiqueta de área y asignado a su
dueño. `bloqueante` marca lo que frena a otra persona.
