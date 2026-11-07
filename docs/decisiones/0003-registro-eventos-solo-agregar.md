# 0003 — Registro de eventos solo-agregar

**Estado:** aceptada

**Contexto:** necesitamos trazabilidad de cada decisión y poder reconstruir la central B si cae la A.

**Decisión:** la central guarda todo como eventos que solo se agregan; nunca se borran ni se
modifican. El estado actual se calcula a partir de los eventos.

**Consecuencias:** auditoría completa y sincronización A → B reproduciendo eventos. Las
correcciones se hacen agregando un evento nuevo.
