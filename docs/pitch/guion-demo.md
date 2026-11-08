# Guion de la demo

Duración: **5 minutos** (unos 35 s por paso más apertura y cierre). Condición adversa: la caída de la
central A en plena carga (paso 7).

## Cómo se corre

Mientras no haya celulares (la app es de P1), los pasos 1 a 3 usan el **plan B**: el simulador hace
de celulares y malla. Las centrales A y B, los agentes y el tablero son los reales.

```bash
cd tablero && npm run dev                                         # terminal 1: tablero (paso 6)
cd simulador && PYTHONUTF8=1 uv run python -m simulador recorrido  # terminal 2: el recorrido
```

- **Visor de la malla** (`http://localhost:8090`, se abre solo): celulares sobre el barrio, el reporte
  saltando, el `SACK` de vuelta, estado de las centrales y el paso actual. En pantalla durante los pasos
  1–5, 7 y 8.
- **Tablero** (`http://localhost:5173`): en pantalla en el paso 6, y al final para mostrar que no se
  perdió nada.
- Se avanza con **Enter** en la terminal o con **«Siguiente paso»** en el visor. `--seguido` avanza solo
  (para ensayar o grabar el video, #23); `--env-file ../.env` usa Jev.
- El script levanta A y B con bases nuevas, registra como unidades 1 equipo de rescate, 1 máquina de bomberos y 2
  ambulancias, y en el paso 7 apaga la A entera (API y agentes) con aviso «3… 2… 1…».
- Puertos libres: 8001, 8002, 8090 y 5173.

Ensayado el 7 de noviembre de 2026 dos veces de corrido: 23 de 23 reportes entregados y confirmados
al reportante, la pasarela pasó a la B durante la caída y, al volver la A, las dos centrales dieron los
mismos incidentes.

## Pasos

| Paso | Qué se ve | Quién lo muestra | Plan B si falla |
|------|-----------|------------------|-----------------|
| 1. Reporte | Sin internet se crea el reporte; prioridad P1 por reglas («atrapad» y atrapados marcado); el mensaje SARD1 de 133 bytes | P1 | Celulares: visor del simulador (lo que se usa hoy) |
| 2. Almacenamiento | El reporte queda «pendiente» en la cola del celular | P1 | Visor del simulador |
| 3. Transmisión | Salta por los relevos hasta la pasarela; dos vecinos reportan lo mismo; se resalta el camino que llegó | P1 | Visor del simulador |
| 4. Agentes | La central A responde `SACK`, que vuelve hasta el reportante: «entregado» | P2 | `central/demo/recorrido.py` |
| 5. Priorización | Los tres reportes quedan en un incidente P1 con su motivo, incertidumbre y acción propuesta | P2 | Solo reglas si Jev falla |
| 6. Tablero | El coordinador abre el incidente, revisa evidencia e incertidumbre y aprueba la acción | P3 | Video (#23) |
| 7. Caída de nodo | Ráfaga de 20 reportes y la central A se apaga entera con reportes en vuelo | P2 | Video (#23) |
| 8. Recuperación | La pasarela sube a la B; todos llegan y todos ven «entregado»; vuelve la A y coincide con la B | P2 | Video (#23) |

Apertura y cierre: P3. Celulares para la versión con app: por definir con P1 (mínimo 3: reportante,
relevo y pasarela).

Frase de cierre: «Reglas en el borde, Jev en el centro, humanos al final. Ningún reporte perdido, ninguna decisión sin una persona.»
