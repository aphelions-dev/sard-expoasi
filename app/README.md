# App y malla (Android)

**Dueño:** Persona 1 (@samcastroca) · **Rama:** `p1/app-malla`

## Base

- Port oficial de bitchat para Android: **https://github.com/permissionlesstech/bitchat-android**
  (organización permissionlesstech; verificado en noviembre de 2026, última versión v2.2.0).
- Licencia: **GPLv3** desde febrero de 2026 (antes MIT). Su README todavía dice "dominio público",
  pero manda el `LICENSE.md`. Ver ADR 0001.
- Kotlin, Android 8.0+ (API 26).

## Fork y submódulo

- Fork: **https://github.com/aphelions-dev/bitchat-android**, en `app/bitchat-android`. Base:
  v2.2.0 (`2fc6f474`).
- Quien clone: `git clone --recurse-submodules ...` o, si ya clonó, `git submodule update --init`.
- Los cambios a bitchat se hacen y se suben en el fork; aquí solo se actualiza el puntero del
  submódulo.

## Compilar

Requisitos (de `.java-version`, `gradle/libs.versions.toml` y el wrapper del fork): **JDK 21**,
**Android SDK 37** (compileSdk y targetSdk), AGP 9.3.1, Kotlin 2.4.10 y Gradle 9.6.1, que lo baja
el wrapper.

1. Instalar Android Studio y, en *SDK Manager*, Android API 37 y *Platform-Tools* (`adb`).
2. Instalar JDK 21 (`winget install EclipseAdoptium.Temurin.21.JDK`): el JDK que trae Android
   Studio es el 25 y Gradle no lo acepta. No aceptar el arreglo automático que ofrece Android
   Studio (agrega el plugin foojay y falla la verificación de dependencias).
3. Compilar desde `app/bitchat-android`, en Git Bash:
   `JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot" ./gradlew :app:assembleDebug`
   (unos 5 min la primera vez). En Android Studio: *Settings → Build Tools → Gradle → Gradle JDK*
   = temurin-21. El APK queda en `app/build/outputs/apk/debug/app-arm64-v8a-debug.apk`.
4. Instalar en cada celular, con *Depuración USB* activada:
   `adb install -r app/build/outputs/apk/debug/app-arm64-v8a-debug.apk`.

Para probar la malla sin compilar sirve el APK oficial de la misma versión:
`gh release download v2.2.0 -R permissionlesstech/bitchat-android -p bitchat-android-arm64.apk`.

La app pide permisos de Bluetooth, ubicación (Android la exige para escanear BLE) y notificaciones.

## Lo que ya hace bitchat-android (leído en el código, por confirmar con celulares)

| Tema | En bitchat-android | Para SARD |
|------|--------------------|-----------|
| Tamaño | Más de 512 bytes se parten en fragmentos de 469 (`AppConstants.Fragmentation`), que se reensamblan con un plazo de 30 s | Un SARD1 típico (133 bytes) cabe en un paquete. El largo máximo del texto se fija midiendo la cabecera, para no fragmentar. |
| Saltos | TTL de 7 (`AppConstants.MESSAGE_TTL_HOPS`) | Suficiente para la demo. |
| Vecino nuevo | `MeshDelegate.didUpdatePeerList(peerIDs)` avisa cuando cambia la lista de pares | Comparar con la lista anterior sirve para reactivar un reporte vencido (regla 5). |
| Quien llega después | `StoreForwardManager` no guarda broadcasts, solo privados. `GossipSyncManager` reenvía a cada vecino que se conecta los broadcasts públicos que le faltan, con capacidad limitada | Si el SARD1 viaja como mensaje público, un relevo que llega tarde lo recibiría. Puede resolver el riesgo de `docs/riesgos.md`. |

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

- [x] Fork creado y agregado como submódulo en `app/bitchat-android`.
- [x] Compila sin cambios (Windows, JDK 21, `:app:assembleDebug`).
- [x] APK instalado en 3 celulares Android: moto g52 (A), moto g32 (B), moto g04s (C).
- [x] Los mensajes llegan entre los 3.
- [ ] **Salto:** un mensaje público de A llega a C pasando por B, con A y C fuera de alcance
      directo (en otra habitación o a más de unos 30 m).
- [ ] **Alcance:** distancia a la que dos celulares dejan de verse, en interior y en exterior.
- [ ] **Retardo:** segundos de A a C, en 5 envíos.
- [ ] **Tamaño:** se envía un SARD1 de 133 bytes y otro cerca de 500 bytes, y se anota si llegan
      completos. El resultado fija el largo máximo del texto en el contrato.
- [ ] **Quien llega después:** con C apagado, A envía; luego se enciende C cerca de B y se anota si
      le llega el mensaje (gossip sync).
- [ ] Resultados en un comentario del issue #1. Si no funciona, avisar para decidir el plan B
      (transporte simulado) antes del Hito 2.

## Terminado

Un reporte creado sin internet llega a la central pasando por al menos un relevo, el reportante ve
"entregado", y con la central A apagada la pasarela usa la B sin perder reportes.
