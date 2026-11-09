# Diseño: tokens compartidos

`tokens.json` es la única fuente de los colores, el radio y las fuentes de SARD. Desde ahí se
generan los archivos de cada interfaz:

| Interfaz | Archivo generado | Tema |
|---|---|---|
| Tablero y app web de reportes (`tablero/`) | `tablero/app/tokens.css` | claro (`:root`, el del proyector) y oscuro (`.dark`, el de la sala) |
| Visor del simulador | `simulador/visor/tokens.css` | oscuro |
| App Android | `app/bitchat-android/.../sard/SardColores.kt` | claro y oscuro, según el sistema |

Para cambiar un color: editar `tokens.json` y correr

```bash
node diseno/generar.mjs            # reescribe los tres archivos
node diseno/generar.mjs --revisar  # sale con 1 si alguno quedó viejo
```

Los generados no se editan a mano. `SardColores.kt` vive en el fork de bitchat (submódulo): se
sube allá y luego se actualiza el puntero del submódulo aquí.

## Reglas

- Grises neutros, bordes finos y sin sombras ni degradados. La acción principal es neutra.
- El color se reserva para el estado: prioridad (`p1`…`p4`), `revisar`, `ok` y `vencido`, cada uno
  con su `-surface` para fondos. En los componentes se usa el token (`bg-p1`), nunca un color
  literal.
- El color de una prioridad va siempre con su texto (P1…P4): nunca es la única señal.
- En el tema oscuro, los tonos de estado suben de luz y bajan de saturación para no encandilar.
- Fuentes: Fira Sans y Fira Code.

Los componentes son los de shadcn/ui del tablero (`tablero/components/ui/`). La app web de
reportes (`/reportar/`) los usa tal cual. El visor y la app Android no son React, así que de ahí
solo comparten los tokens.
