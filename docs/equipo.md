# Cómo trabaja el equipo

Integrantes: Persona 1 = **@samcastroca** (app y malla), Persona 2 = **@lufigir** (central y agentes),
Persona 3 = **@CrArenas** (tablero, simulador y pruebas). Dueños por carpeta en
`.github/CODEOWNERS`; reglas para Claude Code en `CLAUDE.md`.

## Cómo empezar

1. Leer el `README.md`, `CLAUDE.md` y `contracts/protocolo-sard1.md`.
2. Clonar, cambiarse a tu rama y abrir Claude Code en tu carpeta (comandos abajo).
3. Leer el README de tu carpeta y tus issues del hito actual (`docs/plan.md`).

**Persona 1 — @samcastroca (app y malla)**

```bash
git clone --recurse-submodules https://github.com/aphelions-dev/sard-expoasi.git
cd sard-expoasi
git switch p1/app-malla
cd app && claude
```

**Persona 2 — @lufigir (central y agentes)**

```bash
git clone --recurse-submodules https://github.com/aphelions-dev/sard-expoasi.git
cd sard-expoasi
git switch p2/central-agentes
cd central && claude
```

**Persona 3 — @CrArenas (tablero, simulador y pruebas)**

```bash
git clone --recurse-submodules https://github.com/aphelions-dev/sard-expoasi.git
cd sard-expoasi
git switch p3/tablero-pruebas
cd tablero && claude      # o: cd simulador && claude
```

Si ya tenías el repo clonado: `git fetch && git switch <tu-rama>`. Cuando se agregue el submódulo
de bitchat (`app/bitchat-android`), correr una vez `git submodule update --init`.

Antes de abrir cada PR, traer lo último de `dev` a tu rama:

```bash
git fetch && git merge origin/dev
```

## Ramas

| Rama | Uso |
|------|-----|
| `main` | Solo versiones estables para la demo. Protegida. |
| `dev` | Integración. Protegida. |
| `p1/app-malla`, `p2/central-agentes`, `p3/tablero-pruebas` | Trabajo de cada persona, desde `dev`. |
| `contrato/<descripcion>` | Cualquier cambio a `contracts/`. Revisan los tres. |

## Integración

- Al terminar una tarea, PR de tu rama a `dev`. PRs chicos y frecuentes; no acumular.
- Antes de abrir el PR: `git fetch && git merge origin/dev` en tu rama.
- Al cumplirse un hito: PR `dev → main` y tag `hito-1` … `hito-5`.
- Cambios al contrato: nunca dentro de un PR de tu área; rama `contrato/...` aparte.

## Commits

En español, con prefijo: `feat`, `fix`, `docs`, `test`, `chore`, `contrato`.

```
feat: cola de reenvío por prioridad
contrato: definir escape de | en el texto
```

## Issues

Un issue por tarea de `docs/plan.md`, con milestone (`Hito N`), etiqueta de área y asignado a su
dueño. `bloqueante` marca lo que frena a otra persona.
