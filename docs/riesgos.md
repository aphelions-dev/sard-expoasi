# Riesgos y plan B

| Riesgo | Señal | Plan B | Responsable |
|--------|-------|--------|-------------|
| La malla Bluetooth no funciona entre 3 celulares | Falla el criterio del Hito 1 | Transporte simulado: el simulador entrega los mensajes a la pasarela/central. Las bases (sección 4.7) aceptan datos sintéticos y canales simulados | P1 + P3 |
| El jurado ve la central como "un único agente central" (Reto 3 pide no depender de uno) | Pregunta en la evaluación | Cinco agentes en procesos aparte sobre el registro de eventos, sin orquestador: si uno cae, los demás siguen y al volver retoma lo pendiente. Jev caído deja el triaje con reglas, y la central B corre a la vez que la A y toma el relevo si cae (`docs/arquitectura.md`, sección 2). En la demo se muestra apagando un agente y luego la central A | P2 |
| bitchat no guarda mensajes para quien se conecta después | Un relevo que llega tarde no recibe nada | Agregar almacenamiento y reenvío propio en el fork | P1 |
| Jev no disponible (sin clave, caído o lento) | Errores o tiempo de espera en triaje | Triaje solo con reglas | P2 |
| Una palabra crítica negada sube a P1 («no hay carros atrapados», «ya apagamos el fuego»), y las reglas no la bajan (ADR 0005) | Sobretriaje: con el CSV de #13, 2 de 100 reportes | Se acepta: una regla de negación que se equivoca esconde un P1 real (NegEx en español llega a 0,49 de recall en SpRadNeg), y en triaje se acepta hasta 35 % de sobretriaje frente a 5 % de subtriaje (guía de triaje de campo de 2021). La central marca «posible negación» como motivo de revisión y el coordinador lo descarta | P2 |
| Bluetooth falla durante la demo | No llegan mensajes en vivo | Video de respaldo + simulador en vivo | Todos |
| Cambios de licencia en bitchat-android (GPLv3) | Dudas al distribuir | El fork se mantiene GPLv3 y público; ver ADR 0001 | P1 |
| Pocos celulares Android disponibles | Menos de 3 para la demo | Por definir | Todos |
