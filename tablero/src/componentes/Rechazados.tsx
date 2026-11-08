import { ArrowLeft } from "lucide-react";
import type { Prioridad, Rechazado } from "../api/tipos";
import { haceCuanto } from "../formato";
import { InsigniaPrioridad } from "./Insignias";

interface Props {
  lista: Rechazado[] | null;
  ahora: number;
  onVolver: () => void;
}

const PRIORIDADES = new Set(["P1", "P2", "P3", "P4"]);

/** Mensajes que no cumplieron el protocolo: no recibieron SACK, así que el celular sigue
 *  reintentando, pero lo que sí llegó no queda invisible. El orden lo pone la central. */
export function Rechazados({ lista, ahora, onVolver }: Props) {
  const pendientes = lista?.filter((r) => !r.recuperado).length ?? 0;
  return (
    <section className="vista-panel" aria-labelledby="t-rechazados">
      <button className="volver" onClick={onVolver}>
        <ArrowLeft size={16} aria-hidden="true" /> Cola
      </button>
      <header className="vista-cabeza">
        <h2 id="t-rechazados">Mensajes rechazados</h2>
        <p className="tenue">
          Llegaron mal formados o cortados y no recibieron <span className="mono">SACK</span>: el celular sigue reintentando. Aquí se ve lo que
          sí llegó, sin completar nada. «Recuperado» quiere decir que después llegó una versión válida del mismo reporte.
        </p>
      </header>
      {lista === null ? (
        <p className="vacio">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="vacio">No hay mensajes rechazados.</p>
      ) : (
        <>
          <p className="pequeno tenue">
            {pendientes} sin recuperar · {lista.length - pendientes} recuperado{lista.length - pendientes === 1 ? "" : "s"}
          </p>
          <ul className="rechazados">
            {lista.map((r, i) => {
              const p = r.campos.prioridad;
              return (
                <li key={`${r.reporte_id ?? "sin-id"}-${r.recibido_en}-${i}`} className={`rechazado${r.recuperado ? " recuperado" : ""}`}>
                  <div className="rechazado-cabeza">
                    {p && PRIORIDADES.has(p) && <InsigniaPrioridad p={p as Prioridad} />}
                    <span className="mono">{r.reporte_id ?? "id ilegible"}</span>
                    <span className={`insignia ${r.recuperado ? "e-aprobada" : "revisar"}`}>{r.recuperado ? "Recuperado" : "Sin recuperar"}</span>
                    <span className="separa" />
                    <span className="tenue pequeno">
                      {r.pasarela_id ?? "pasarela desconocida"} · {haceCuanto(r.recibido_en, ahora)}
                    </span>
                  </div>
                  <ul className="lista">
                    {r.motivos.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  {Object.keys(r.campos).length > 0 ? (
                    <dl className="campos">
                      {Object.entries(r.campos).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k.replace("_", " ")}</dt>
                          <dd className="mono">{v === "" ? <em className="tenue">vacío</em> : v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="pequeno tenue">No llegó ningún campo legible.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
