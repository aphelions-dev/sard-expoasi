# Tablero del coordinador

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/tablero-pruebas`

Stack: **por definir**.

## Alcance

Ver reportes e incidentes priorizados, con evidencia e incertidumbre, y aprobar o rechazar las
acciones propuestas.

## No le toca

Lógica de triaje (vive en la central), app Android, base de datos de la central.

## Dependencias

- `GET /incidentes` y `POST /incidentes/{id}/aprobacion` de Persona 2 (`contracts/api-central.md`).
- Mientras la API no exista: datos de `contracts/ejemplos/` o del simulador.

## Tareas por hito

- **Hito 2:** mostrar los reportes recibidos.
- **Hito 3:** incidentes con evidencia, incertidumbre y aprobación.
- **Hito 4:** mostrar el estado de las centrales A/B y de Jev (`GET /salud`).
- **Hito 5:** pulido para la demo.

## Terminado

El coordinador ve los incidentes ordenados por prioridad, entiende por qué cada uno tiene esa
prioridad, y ninguna acción avanza sin que la apruebe.
