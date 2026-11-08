# Uso responsable de la IA

- **Sin invenciones:** los agentes solo usan lo que dice el reporte. Si falta un dato, queda vacío
  o "desconocido"; nunca se completa con suposiciones.
- **Errores asimétricos:** subestimar una emergencia es peor que sobrestimarla. Jev puede subir una
  prioridad, nunca bajarla. Las reglas ganan cuando hay palabra crítica (ADR 0005).
- **Humano al final:** ninguna acción se ejecuta sin aprobación del coordinador.
- **Trazabilidad:** cada decisión queda en el registro de eventos con su fuente (reglas o Jev), su
  justificación y la hora. Nada se borra.
- **Incertidumbre visible:** el tablero muestra qué tan seguro está el sistema y por qué.
- **Sesgos:** revisar si la prioridad depende de cómo se escribe (ortografía, dialecto, longitud
  del texto). Método: el mismo suceso escrito de cinco formas (cuidado, con faltas, coloquial,
  corto y largo) pasa por el triaje con el formulario neutro, y se mide si cambia la prioridad
  (`central/sesgo/`). Primera corrida, con 40 reportes y `jev-1.14.0`: ningún caso grave quedó
  por debajo de su prioridad. Sin Jev, las reglas solo ven las palabras críticas escritas tal
  cual, así que en ese modo pesa lo que el reportante marca en el formulario.
- **Datos sintéticos:** todas las pruebas y la demo usan reportes inventados y etiquetados a mano;
  nunca datos de personas reales.
- **Degradación segura:** si Jev no está disponible, el sistema sigue funcionando solo con reglas.
