# App y malla (Android)

**Dueño:** Persona 1 (@samcastroca) · **Rama:** `p1/app-malla`

## Base

- Port oficial de bitchat para Android: **https://github.com/permissionlesstech/bitchat-android**
  (organización permissionlesstech; verificado en noviembre de 2026, última versión v2.2.0).
- Licencia: **GPLv3** desde febrero de 2026 (antes MIT). No es de dominio público; ver ADR 0001.
- Kotlin, Android 8.0+.

## Integrar el fork como submódulo

1. Hacer fork de `permissionlesstech/bitchat-android` en la organización del equipo
   (nombre: por definir, propuesta `aphelions-dev/bitchat-android`).
2. Desde la raíz del repo, en la rama `p1/app-malla`:
   ```
   git submodule add https://github.com/aphelions-dev/bitchat-android app/bitchat-android
   git commit -m "chore: agregar fork de bitchat-android como submódulo"
   ```
3. Quien clone: `git clone --recurse-submodules ...` o, si ya clonó, `git submodule update --init`.
4. Los cambios a bitchat se hacen y suben en el fork; aquí solo se actualiza el puntero.

## Roles del celular (mismo build, cambia la configuración)

| Rol | Internet | Hace |
|-----|----------|------|
| Reportante | no | Crea el reporte, calcula prioridad, lo guarda y lo emite. Ve "entregado" al recibir `SACK`. |
| Relevo | no | Guarda y reenvía reportes ajenos por prioridad. |
| Pasarela | sí | Sube los reportes a la central por HTTP con failover A → B y devuelve `SACK` a la malla. |

Cómo se elige el rol (ajuste en la app, detección de internet u otro): **por definir**.
Cantidad de celulares para la demo: por definir, mínimo 3.

## Alcance

Formulario offline, prioridad por reglas, almacenamiento local, cola de reenvío por prioridad,
`SACK`, modo pasarela con envío HTTP y failover entre central A y B.

## No le toca

Agentes, triaje con Jev, base de datos de la central, tablero, simulador.

## Dependencias

- `contracts/protocolo-sard1.md` (formato del mensaje).
- `contracts/api-central.md`: `POST /reportes` y `GET /salud` de Persona 2.
- Persona 3 usa los mismos mensajes en el simulador.

## Tareas por hito

- **Hito 1:** compilar el fork y lograr mensajes entre 3 celulares Android.
- **Hito 2:** formulario, prioridad por reglas, almacenamiento local, modo pasarela y `SACK`.
- **Hito 3:** cola de reenvío por prioridad y reintentos con espera creciente.
- **Hito 4:** failover de la pasarela entre central A y B.
- **Hito 5:** integración del recorrido de 8 pasos y APK de la demo.

### Checklist Hito 1

- [ ] Fork creado y agregado como submódulo en `app/bitchat-android`.
- [ ] Compila en Android Studio sin cambios.
- [ ] APK instalado en 3 celulares Android.
- [ ] Un mensaje de A llega a C pasando por B (A y C fuera de alcance directo).
- [ ] Anotar alcance aproximado, retardo y si bitchat guarda mensajes para quien llega después.
- [ ] Si no funciona: avisar para decidir el plan B (transporte simulado) antes del Hito 2.

## Terminado

Un reporte creado sin internet llega a la central pasando por al menos un relevo, el reportante ve
"entregado", y con la central A apagada la pasarela usa la B sin perder reportes.
