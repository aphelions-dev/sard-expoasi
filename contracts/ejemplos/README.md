# Ejemplos SARD1

| Archivo | Caso | Resultado esperado en la central |
|---------|------|----------------------------------|
| 01 | Válido, P1 atrapados | Aceptado, `SACK` |
| 02 | Válido, P2 médico | Aceptado, `SACK` |
| 03 | Válido, sin texto | Aceptado, `SACK` |
| 04 | Sin GPS (geohash vacío) | Aceptado, `SACK` |
| 05 | Mismo id dos veces | Un solo reporte, `SACK` a ambos |
| 06 | Truncado | Rechazado y registrado |
| 07 | Texto largo | Aceptado; recorte según límite por definir |
| 08 | Acuse | Lo procesa la app, no la central |
| 09 | Prioridad, tipo, banderas y hora inválidos | Rechazado y registrado |
