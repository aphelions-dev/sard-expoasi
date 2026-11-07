# 0004 — Jev solo en la central

**Estado:** aceptada

**Contexto:** Jev (TypeSafe AI) requiere internet; los celulares de la malla no lo tienen.

**Decisión:** el celular prioriza solo con reglas. Jev se usa únicamente en la central: en el
agente de triaje (señales de riesgo en el texto) y en el de correlación (si dos reportes describen
el mismo suceso o se contradicen). Ningún otro agente lo llama.

**Consecuencias:** la malla funciona sin red. Si Jev falla o tarda, el triaje sigue con reglas, la
correlación usa una regla conservadora, y el evento registra que Jev no participó.
