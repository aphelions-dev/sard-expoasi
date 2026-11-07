# 0004 — Jev solo en la central

**Estado:** aceptada

**Contexto:** Jev (TypeSafe AI) requiere internet; los celulares de la malla no lo tienen.

**Decisión:** el celular prioriza solo con reglas. Jev se usa únicamente en el agente de triaje de
la central.

**Consecuencias:** la malla funciona sin red. Si Jev falla o tarda, el triaje sigue con reglas y el
evento registra que Jev no participó.
