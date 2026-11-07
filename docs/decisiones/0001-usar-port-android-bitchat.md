# 0001 — Usar el port Android de bitchat

**Estado:** aceptada

**Contexto:** necesitamos una malla Bluetooth entre celulares sin internet ya probada, no hacerla
desde cero.

**Decisión:** hacer fork de `permissionlesstech/bitchat-android` (Kotlin) e integrarlo como
submódulo en `app/bitchat-android`.

**Consecuencias:**
- Malla, cifrado y reenvío ya resueltos; nos concentramos en el formulario, la prioridad y la pasarela.
- **Licencia:** el port Android es GPLv3 desde febrero de 2026 (antes MIT); el bitchat de iOS sí
  es de dominio público. Nuestro fork debe seguir siendo GPLv3 y su código fuente público si se
  distribuye el APK. Licencia del resto del repo: por definir.
- Dependemos de su protocolo interno; el nuestro (SARD1) viaja como contenido del mensaje.
