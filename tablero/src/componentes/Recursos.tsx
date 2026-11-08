import { useState } from "react";
import { ArrowLeft, LoaderCircle, TriangleAlert } from "lucide-react";
import { declararRecurso, ErrorApi, type Nodo } from "../api/central";
import type { Incidente, Recurso } from "../api/tipos";
import { TIPO, haceCuanto } from "../formato";
import { filas, type FilaRecurso } from "../recursos";

interface Props {
  declarados: Recurso[] | null;
  incidentes: Incidente[];
  nodo: Nodo | null;
  coordinador: string;
  ahora: number;
  onDeclarado: () => void;
  onVolver: () => void;
}

/** Lo que el coordinador tiene disponible. La coordinación no propone lo que no hay, y cada
 *  aprobación compromete una unidad. */
export function Recursos({ declarados, incidentes, nodo, coordinador, ahora, onDeclarado, onVolver }: Props) {
  return (
    <section className="vista-panel" aria-labelledby="t-recursos">
      <button className="volver" onClick={onVolver}>
        <ArrowLeft size={16} aria-hidden="true" /> Cola
      </button>
      <header className="vista-cabeza">
        <h2 id="t-recursos">Recursos</h2>
        <p className="tenue">
          Declara cuántas unidades tienes libres ahora. Cada aprobación compromete una; declarar otra vez reemplaza lo anterior y
          vuelve a contar desde ahí.
        </p>
      </header>
      {declarados === null ? (
        <p className="vacio">Cargando…</p>
      ) : (
        <ul className="recursos">
          {filas(declarados, incidentes).map((f) => (
            <FilaRecursoVista key={`${f.entidad}|${f.recurso}`} f={f} nodo={nodo} coordinador={coordinador} ahora={ahora} onDeclarado={onDeclarado} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilaRecursoVista({ f, nodo, coordinador, ahora, onDeclarado }: { f: FilaRecurso; nodo: Nodo | null; coordinador: string; ahora: number; onDeclarado: () => void }) {
  const d = f.declarado;
  const [valor, setValor] = useState(String(d?.disponibles ?? ""));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const sinNombre = !coordinador.trim();
  const n = Number(valor);
  const valido = valor.trim() !== "" && Number.isInteger(n) && n >= 0;
  const faltan = d ? f.piden - d.disponibles : 0;

  async function declarar() {
    if (!nodo || !valido) return;
    setEnviando(true);
    setError(null);
    setHecho(false);
    try {
      await declararRecurso(nodo, { entidad: f.entidad, recurso: f.recurso, disponibles: n, coordinador: coordinador.trim() });
      setHecho(true);
      onDeclarado();
    } catch (e) {
      setError(e instanceof ErrorApi ? `La central respondió ${e.estado}: ${e.message}` : "No se pudo hablar con la central; no se registró.");
    } finally {
      setEnviando(false);
    }
  }

  const id = `rec-${f.entidad}-${f.recurso}`.replace(/\s+/g, "-");
  return (
    <li className="recurso">
      <div className="recurso-nombre">
        <h3>{f.recurso}</h3>
        <p className="tenue pequeno">
          {f.entidad}
          {f.tipos.length > 0 && ` · ${f.tipos.map((t) => TIPO[t]).join(", ")}`}
        </p>
      </div>

      <div className="recurso-estado">
        {d ? (
          <>
            <p>
              <strong className={`recurso-num${d.disponibles === 0 ? " agotado" : ""}`}>{d.disponibles}</strong>
              <span className="tenue"> libres de {d.declarados}</span>
            </p>
            <div className="medidor" role="meter" aria-valuemin={0} aria-valuemax={d.declarados} aria-valuenow={d.comprometidos} aria-label={`${d.comprometidos} comprometidas de ${d.declarados}`}>
              <span style={{ width: d.declarados ? `${(d.comprometidos / d.declarados) * 100}%` : "0" }} />
            </div>
            <p className="tenue pequeno">
              {d.comprometidos} comprometida{d.comprometidos === 1 ? "" : "s"} · declarado por {d.coordinador} {haceCuanto(d.declarado_en, ahora)}
            </p>
          </>
        ) : (
          <p className="aviso-texto pequeno">Sin declarar: la coordinación propone sin saber si hay.</p>
        )}
        <p className={`pequeno${faltan > 0 ? " aviso-texto" : " tenue"}`}>
          {faltan > 0 && <TriangleAlert size={13} aria-hidden="true" className="en-linea" />}
          {f.piden} incidente{f.piden === 1 ? "" : "s"} pendiente{f.piden === 1 ? "" : "s"} lo pide{f.piden === 1 ? "" : "n"}
          {faltan > 0 && ` · faltan ${faltan}`}
        </p>
      </div>

      <div className="recurso-form">
        <label htmlFor={id} className="pequeno">
          Unidades libres ahora
        </label>
        <div className="recurso-fila">
          <input
            id={id}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setHecho(false);
            }}
          />
          <button className="boton primario" disabled={sinNombre || !valido || enviando || !nodo} onClick={declarar}>
            {enviando && <LoaderCircle size={16} className="gira" aria-hidden="true" />}
            Declarar
          </button>
        </div>
        {sinNombre && <p className="ayuda">Escribe tu nombre arriba a la derecha para declarar.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {hecho && (
          <p className="ok-texto pequeno" role="status">
            Declarado.
          </p>
        )}
      </div>
    </li>
  );
}
