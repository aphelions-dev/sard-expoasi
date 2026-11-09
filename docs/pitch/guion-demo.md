# Guion de la demo

Duración: **5 minutos** (unos 35 s por paso más apertura y cierre). Condición adversa: la caída de la
central A en plena carga (paso 7).

## Cómo se corre

Los pasos 1 a 4 se hacen con **3 celulares de la app** (A reportante, B relevo, C pasarela) y el
simulador solo hace la ráfaga del paso 7 (#86). Las centrales A y B, los agentes y el tablero son los
reales. La preparación de los celulares está en `app/README.md`, "Demo con celulares".

```bash
cd tablero && npm run dev -- -p 5173                                          # terminal 1: tablero (paso 6)
cd simulador && PYTHONUTF8=1 uv run python -m simulador recorrido --celulares  # terminal 2: el recorrido
```

- Al arrancar, el script imprime las URL que van en la pasarela del celular C (`http://<IP del PC>:8001`
  y `:8002`).
- Pasos 1 y 2: se muestran en el celular A (la hoja SOS y *Mis reportes*); se avanza con Enter.
- Paso 3: el script espera el **primer reporte que sube la pasarela** y el resto del recorrido sigue ese
  id. El celular B manda un segundo reporte del mismo suceso; el script espera que la central los junte
  en un incidente, o se sigue con Enter. Si en 10 min no llega nada, se corta y se pasa al plan B.
- Paso 4: en el celular A, *Mis reportes* → «✓ entregado».
- Paso 8: la pasarela del celular C también pasa sola a la B (probado en #14).
- **Plan B**, si fallan los celulares: el mismo comando sin `--celulares`. El simulador hace de celulares
  y malla en todos los pasos.
- **Visor de la malla** (`http://localhost:8090`, se abre solo): celulares sobre el barrio, el reporte
  saltando, el `SACK` de vuelta, estado de las centrales y el paso actual. En pantalla durante los pasos
  7 y 8 (en el plan B, también en los pasos 1 a 5).
- **Tablero** (`http://localhost:5173`): en pantalla en el paso 6, y al final para mostrar que no se
  perdió nada.
- Se avanza con **Enter** en la terminal o con **«Siguiente paso»** en el visor. `--seguido` avanza solo
  (para ensayar o grabar el video, #23); `--env-file ../.env` usa Jev.
- El script levanta A y B con bases nuevas, registra como unidades 1 equipo de rescate, 1 máquina de bomberos y 2
  ambulancias, y en el paso 7 apaga la A entera (API y agentes) con aviso «3… 2… 1…».
- Puertos libres: 8001, 8002, 8090 y 5173.

Ensayado el 7 de noviembre de 2026 dos veces de corrido: 23 de 23 reportes entregados y confirmados
al reportante, la pasarela pasó a la B durante la caída y, al volver la A, las dos centrales dieron los
mismos incidentes. El 9 de noviembre se probó `--celulares` con un script en lugar de la pasarela del
celular C (2 reportes juntados en un incidente, 20 de 20 en la ráfaga); falta el ensayo con los celulares.

## Pasos

| Paso | Qué se ve | Quién lo muestra | Plan B si falla |
|------|-----------|------------------|-----------------|
| 1. Reporte | Sin internet se crea el reporte; prioridad P1 por reglas («atrap» y atrapados marcado); el mensaje SARD1 con sus bytes en la hoja SOS del celular A | P1 | Recorrido sin `--celulares` (visor del simulador) |
| 2. Almacenamiento | El reporte queda «pendiente» en *Mis reportes* del celular A | P1 | Visor del simulador |
| 3. Transmisión | Salta de A a B y de B a C, la pasarela; el celular B reporta lo mismo | P1 | Visor del simulador |
| 4. Agentes | La central A responde `SACK`, que vuelve hasta el reportante: «entregado» | P2 | `central/demo/recorrido.py` |
| 5. Priorización | Los reportes del mismo suceso quedan en un incidente P1 con su motivo, incertidumbre y acción propuesta | P2 | Solo reglas si Jev falla |
| 6. Tablero | El coordinador abre el incidente, revisa evidencia e incertidumbre y aprueba la acción | P3 | Video (#23) |
| 7. Caída de nodo | Ráfaga de 20 reportes y la central A se apaga entera con reportes en vuelo | P2 | Video (#23) |
| 8. Recuperación | La pasarela sube a la B; todos llegan y todos ven «entregado»; vuelve la A y coincide con la B | P2 | Video (#23) |

Apertura y cierre: P3. Celulares: los 3 de `app/README.md` (A reportante,
B relevo y C pasarela).

Frase de cierre: «Reglas en el borde, Jev en el centro, humanos al final. Ningún reporte perdido, ninguna decisión sin una persona.»
