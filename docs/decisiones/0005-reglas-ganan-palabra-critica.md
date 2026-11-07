# 0005 — Las reglas ganan cuando hay palabra crítica

**Estado:** aceptada

**Contexto:** un modelo puede equivocarse a la baja, y subestimar una emergencia es el peor error.

**Decisión:** si el reporte contiene una palabra crítica, la prioridad de reglas no se puede bajar.
En general, Jev puede subir una prioridad, nunca bajarla.

**Consecuencias:** más falsos positivos, ningún P1 degradado por el modelo. Lista de palabras
críticas: por definir (compartida entre la app y la central).
