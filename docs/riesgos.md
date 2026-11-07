# Riesgos y plan B

| Riesgo | Señal | Plan B | Responsable |
|--------|-------|--------|-------------|
| La malla Bluetooth no funciona entre 3 celulares | Falla el criterio del Hito 1 | Transporte simulado: el simulador entrega los mensajes a la pasarela/central | P1 + P3 |
| bitchat no guarda mensajes para quien se conecta después | Un relevo que llega tarde no recibe nada | Agregar almacenamiento y reenvío propio en el fork | P1 |
| Jev no disponible (sin clave, caído o lento) | Errores o tiempo de espera en triaje | Triaje solo con reglas | P2 |
| Bluetooth falla durante la demo | No llegan mensajes en vivo | Video de respaldo + simulador en vivo | Todos |
| Cambios de licencia en bitchat-android (GPLv3) | Dudas al distribuir | El fork se mantiene GPLv3 y público; ver ADR 0001 | P1 |
| Pocos celulares Android disponibles | Menos de 3 para la demo | Por definir | Todos |
