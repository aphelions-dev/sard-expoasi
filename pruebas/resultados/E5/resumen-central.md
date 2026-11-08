# E5 · Caída de la central A durante la carga

Malla base (semilla 5, 30 celulares, pérdida 10%) subiendo a la API real. La central A completa (API y agentes) se apaga en el segundo 120, con 25 de 60 reportes ya creados y el resto todavía por crearse.

| Métrica | Valor |
|---|---|
| Entregados | 60 de 60 (100%) |
| Perdidos | 0 |
| Confirmados al reportante | 60 |
| Subidas por central | {'A': 25, 'B': 30} |
| Subidas que fallaron y se reintentaron | 8 |
| Con `SACK` de la A pero ausentes en la B mientras la A está caída | 0  |
| Ausentes en la B después de que la A vuelve | 0 |
| Cumple «0 perdidos; la pasarela pasa a B» | sí |

Los reportes que la A confirmó justo antes de caer y la B no alcanzó a copiar (sincroniza cada segundo) no se pierden: quedan en la base de la A y la B los recibe cuando la A vuelve. Mientras la A está caída, el coordinador no los ve en la B y el celular ya no reintenta, porque recibió `SACK`.

| Prioridad | Entregados | Latencia p50 (s) | p95 (s) | Máx (s) |
|---|---|---|---|---|
| P1 | 25/25 | 3 | 6 | 7 |
| P2 | 12/12 | 3 | 6 | 6 |
| P3 | 7/7 | 3 | 6 | 6 |
| P4 | 16/16 | 2 | 7 | 7 |
