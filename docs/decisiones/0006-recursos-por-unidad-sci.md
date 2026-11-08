# 0006 — Recursos por unidad, como en el Sistema de Comando de Incidentes

**Estado:** propuesta

**Contexto:** hasta ahora el coordinador declaraba un total por recurso ("ambulancias libres: 3")
y cada aprobación descontaba una unidad que nunca volvía sola. Para liberar una había que contar de
cabeza y declarar de nuevo; una declaración borraba las aprobaciones que llegaban mientras tanto, y
el total envejecía apenas se escribía. Además, el coordinador no es quien conoce las unidades: en el
Sistema de Comando de Incidentes (SCI), que usan los organismos de socorro en la región, los
recursos los registra cada institución, unidad por unidad, en el formulario SCI-211, con tres
estados (disponible, asignado, no disponible), y el cambio de estado lo reporta quien lo autoriza.

**Decisión:** los recursos se llevan por unidad, con matrícula, entidad y estado, y los actualiza
la entidad dueña. Aprobar una acción es solicitar el recurso, no asignarlo; la asignación y la
liberación las reporta la entidad. Se usa el vocabulario del SCI. Se elimina la declaración de
totales (`POST /recursos`), sin capa de compatibilidad.

**Consecuencias:**

- Lo disponible se calcula del registro de eventos (`unidad_registrada`, `unidad_estado`,
  `recurso_solicitado`), sin un número que alguien tenga que mantener; encaja con ADR 0003.
- La coordinación sigue sin despachar (ninguna acción sin aprobación humana) y ahora tampoco
  descuenta unidades que nadie confirmó.
- El tablero necesita una vista para que cada entidad registre sus unidades y reporte cambios, y
  muestra las solicitudes abiertas sin unidad asignada.
- Cambia la central (agente de coordinación, vista de incidentes, API) y el tablero.
- Fuente: Curso Básico e Intermedio de SCI (USAID/OFDA), formulario SCI-211 "Registro y Control
  de Recursos".
