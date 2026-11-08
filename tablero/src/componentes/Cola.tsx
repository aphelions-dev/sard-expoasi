import { useRef } from "react";
import { Clock, MapPin, MapPinOff, Users } from "lucide-react";
import type { Incidente } from "../api/tipos";
import type { Barrio } from "../geo/geo";
import { FILTROS, conteos, filtrar, type Filtro } from "../cola";
import { TIPO, haceCuanto } from "../formato";
import { InsigniaConfianza, InsigniaEstado, InsigniaPrioridad, InsigniaRevisar } from "./Insignias";

interface Props {
  incidentes: Incidente[];
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  seleccion: string | null;
  onSeleccion: (id: string) => void;
  ahora: number;
  barrio: (gh: string | null) => Barrio | null;
}

export function Cola({ incidentes, filtro, onFiltro, seleccion, onSeleccion, ahora, barrio }: Props) {
  const lista = filtrar(incidentes, filtro);
  const n = conteos(incidentes);
  const ref = useRef<HTMLUListElement>(null);

  // Flechas arriba/abajo recorren la cola sin soltar el teclado.
  function teclado(e: React.KeyboardEvent, i: number) {
    const paso = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const sig = lista[i + paso];
    if (!sig) return;
    onSeleccion(sig.id);
    ref.current?.querySelectorAll<HTMLButtonElement>("button.fila")[i + paso]?.focus();
  }

  return (
    <section className="cola" aria-label="Cola de incidentes">
      <div className="filtros" role="tablist" aria-label="Filtrar incidentes">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            className={`filtro${filtro === f.id ? " activo" : ""}`}
            onClick={() => onFiltro(f.id)}
          >
            {f.etiqueta}
            <span className="filtro-n">{n[f.id]}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="vacio">{incidentes.length ? "Ningún incidente con este filtro." : "Todavía no hay incidentes."}</p>
      ) : (
        <ul className="filas" ref={ref}>
          {lista.map((inc, i) => (
            <li key={inc.id}>
              <button
                className={`fila p-borde-${inc.prioridad.toLowerCase()}${seleccion === inc.id ? " seleccionada" : ""}`}
                aria-current={seleccion === inc.id}
                onClick={() => onSeleccion(inc.id)}
                onKeyDown={(e) => teclado(e, i)}
              >
                <div className="fila-arriba">
                  <InsigniaPrioridad p={inc.prioridad} />
                  <span className="fila-tipo">{TIPO[inc.tipo]}</span>
                  <span className="fila-hora mono">{haceCuanto(inc.hora_unix, ahora)}</span>
                </div>
                <p className="fila-texto">{inc.evidencia[0]?.texto || <em>Sin texto</em>}</p>
                <p className="fila-motivo" title="Por qué está en este lugar de la cola">
                  {inc.motivo_orden}
                </p>
                {inc.vigencia.sin_noticias_recientes && (
                  <p className="fila-vigencia">
                    <Clock size={13} aria-hidden="true" />
                    Sin noticias hace {inc.vigencia.minutos_sin_noticias} min
                  </p>
                )}
                <div className="fila-abajo">
                  <span className="dato">
                    <Users size={13} aria-hidden="true" />
                    {inc.impacto.personas}
                    {inc.impacto.vulnerables && " · vulnerables"}
                  </span>
                  <span className="dato">{inc.reportes.length} rep.</span>
                  {inc.geohash && barrio(inc.geohash) && (
                    <span className="dato">
                      <MapPin size={13} aria-hidden="true" />
                      {barrio(inc.geohash)!.nombre}
                    </span>
                  )}
                  {inc.incertidumbre.sin_ubicacion && (
                    <span className="dato aviso">
                      <MapPinOff size={13} aria-hidden="true" />
                      sin ubicación
                    </span>
                  )}
                  <span className="separa" />
                  {inc.incertidumbre.revisar && <InsigniaRevisar />}
                  <InsigniaConfianza c={inc.incertidumbre.corroboracion} />
                  <InsigniaEstado e={inc.estado} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
