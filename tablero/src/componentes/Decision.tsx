import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type { Incidente } from "../api/tipos";
import { decidir, mensajeDecision, type Nodo } from "../api/central";
import { InsigniaPrioridad } from "./Insignias";

interface Props {
  inc: Incidente;
  nodo: Nodo | null;
  coordinador: string;
  onDecidido: () => void;
}

/** Acción propuesta y decisión humana. Nada avanza sin que el coordinador apriete un botón. */
export function Decision({ inc, nodo, coordinador, onDecidido }: Props) {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState<"aprobar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const a = inc.accion_propuesta;

  if (!a) {
    return (
      <section className="panel accion" aria-labelledby="t-accion">
        <h2 id="t-accion">Acción propuesta</h2>
        <p className="tenue">La coordinación todavía no propone una acción para este incidente.</p>
      </section>
    );
  }

  const decisionVigente = inc.decision && inc.decision.accion_id === a.id ? inc.decision : null;
  const decisionAnterior = inc.decision && !decisionVigente ? inc.decision : null;
  const notaObligatoria = inc.incertidumbre.revisar;
  const sinNombre = !coordinador.trim();
  const faltaNota = notaObligatoria && !nota.trim();

  async function enviar(decision: "aprobar" | "rechazar") {
    if (!nodo) return;
    setEnviando(decision);
    setError(null);
    try {
      await decidir(nodo, inc.id, { decision, coordinador: coordinador.trim(), nota: nota.trim() });
      setNota("");
      onDecidido();
    } catch (e) {
      setError(mensajeDecision(e));
    } finally {
      setEnviando(null);
    }
  }

  const r = inc.recurso;
  return (
    <section className="panel accion" aria-labelledby="t-accion">
      <h2 id="t-accion">Acción propuesta</h2>
      <p className="accion-que">{a.accion}</p>
      <dl className="pares">
        <dt>Entidad</dt>
        <dd>{a.entidad}</dd>
        {a.recurso && (
          <>
            <dt>Recurso</dt>
            <dd>
              {a.recurso}
              {r && (
                <span className={`recurso-disp${r.disponibles === 0 ? " agotado" : ""}`}>
                  {r.disponibles === null ? "sin declarar" : `${r.disponibles} disponibles`}
                </span>
              )}
            </dd>
          </>
        )}
        <dt>Personas</dt>
        <dd>{a.personas_estimadas}</dd>
        <dt>Prioridad</dt>
        <dd>
          <InsigniaPrioridad p={a.prioridad} />
        </dd>
      </dl>
      {r && r.compiten.length > 0 && !decisionVigente && (
        <p className="aviso-caja">
          Compite por {r.recurso} con {r.compiten.length} incidente{r.compiten.length > 1 ? "s" : ""} pendiente
          {r.compiten.length > 1 ? "s" : ""} de igual o mayor prioridad: <span className="mono">{r.compiten.join(", ")}</span>
        </p>
      )}
      <p className="justificacion">{a.justificacion}</p>
      {a.falta_confirmar.length > 0 && (
        <div className="falta">
          <h3>Falta confirmar</h3>
          <ul>
            {a.falta_confirmar.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {decisionAnterior && (
        <p className="tenue pequeno">
          Llegó información nueva después de la decisión anterior ({decisionAnterior.decision === "aprobar" ? "aprobada" : "rechazada"} por{" "}
          {decisionAnterior.coordinador}): esta es una propuesta nueva.
        </p>
      )}

      {decisionVigente ? (
        <div className={`decidida d-${decisionVigente.decision}`} role="status">
          {decisionVigente.decision === "aprobar" ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
          <div>
            <strong>{decisionVigente.decision === "aprobar" ? "Aprobada" : "Rechazada"}</strong> por {decisionVigente.coordinador}
            {decisionVigente.nota && <p className="pequeno">«{decisionVigente.nota}»</p>}
          </div>
        </div>
      ) : (
        <div className="formulario">
          <label htmlFor="nota">
            Nota {notaObligatoria ? <span className="obligatoria">obligatoria para aprobar</span> : <span className="tenue">opcional</span>}
          </label>
          <textarea
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            aria-describedby="ayuda-nota"
            placeholder={notaObligatoria ? "Por qué apruebas lo que el sistema marcó para revisar" : "Contexto para el equipo"}
          />
          <p id="ayuda-nota" className="ayuda">
            {sinNombre
              ? "Escribe tu nombre arriba a la derecha para poder decidir."
              : notaObligatoria
                ? "El sistema marcó este incidente para revisar."
                : `Decides como ${coordinador.trim()}.`}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="botones">
            <button className="boton secundario" disabled={sinNombre || !!enviando || !nodo} onClick={() => enviar("rechazar")}>
              {enviando === "rechazar" ? <LoaderCircle size={16} className="gira" aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              Rechazar
            </button>
            <button className="boton primario" disabled={sinNombre || faltaNota || !!enviando || !nodo} onClick={() => enviar("aprobar")}>
              {enviando === "aprobar" ? <LoaderCircle size={16} className="gira" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Aprobar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
