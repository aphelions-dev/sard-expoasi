import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";
import type { Evidencia, Incidente } from "../api/tipos";
import type { Nodo } from "../api/central";
import { FUENTE, ORIGEN, TIPO, coordenadas, haceCuanto, horaLocal } from "../formato";
import { Decision } from "./Decision";
import { InsigniaConfianza, InsigniaEstado, InsigniaPrioridad, InsigniaRevisar } from "./Insignias";

interface Props {
  inc: Incidente;
  nodo: Nodo | null;
  coordinador: string;
  ahora: number;
  onDecidido: () => void;
  onVolver: () => void;
}

export function Detalle({ inc, nodo, coordinador, ahora, onDecidido, onVolver }: Props) {
  const u = inc.incertidumbre;
  return (
    <article className="detalle" aria-labelledby="t-incidente">
      <button className="volver" onClick={onVolver}>
        <ArrowLeft size={16} aria-hidden="true" /> Cola
      </button>

      <header className="detalle-cabeza">
        <div className="detalle-titulo">
          <InsigniaPrioridad p={inc.prioridad} grande />
          <h2 id="t-incidente">{TIPO[inc.tipo]}</h2>
          <InsigniaEstado e={inc.estado} />
          {u.revisar && <InsigniaRevisar />}
        </div>
        <p className="motivo">
          <span className="tenue">Por qué está aquí:</span> {inc.motivo_orden}
        </p>
        <p className="mono tenue pequeno">{inc.id}</p>
      </header>

      <div className="resumen">
        <div className="dato-grande">
          <span className="etiqueta">
            <MapPin size={14} aria-hidden="true" /> Ubicación
          </span>
          {inc.geohash ? (
            <span>
              <span className="mono">{inc.geohash}</span>
              <span className="tenue pequeno"> · {coordenadas(inc.geohash)}</span>
            </span>
          ) : (
            <span className="aviso-texto">Sin ubicación: el reporte no trajo GPS</span>
          )}
        </div>
        <div className="dato-grande">
          <span className="etiqueta">
            <Users size={14} aria-hidden="true" /> Impacto
          </span>
          <span>
            {inc.impacto.personas} persona{inc.impacto.personas === 1 ? "" : "s"}
            {inc.impacto.vulnerables && <strong className="vulnerables"> · niños o adultos mayores</strong>}
          </span>
        </div>
        <div className="dato-grande">
          <span className="etiqueta">
            <Clock size={14} aria-hidden="true" /> Primer reporte
          </span>
          <span>
            {horaLocal(inc.hora_unix)} <span className="tenue pequeno">({haceCuanto(inc.hora_unix, ahora)})</span>
          </span>
        </div>
        <div className="dato-grande">
          <span className="etiqueta">Último reporte</span>
          <span className={inc.vigencia.sin_noticias_recientes ? "aviso-texto" : ""}>
            {haceCuanto(inc.vigencia.ultimo_reporte_unix, ahora)}
            {inc.vigencia.sin_noticias_recientes && " · sin noticias recientes"}
          </span>
        </div>
      </div>

      <div className="detalle-cuerpo">
        <div className="columna-principal">
          <Incertidumbre inc={inc} />
          <section className="panel" aria-labelledby="t-evidencia">
            <h2 id="t-evidencia">
              Evidencia <span className="tenue">· {inc.evidencia.length} reporte{inc.evidencia.length === 1 ? "" : "s"}</span>
            </h2>
            <ol className="evidencias">
              {inc.evidencia.map((ev) => (
                <ItemEvidencia key={ev.reporte_id} ev={ev} ahora={ahora} />
              ))}
            </ol>
          </section>
        </div>
        <aside className="columna-accion">
          <Decision key={inc.accion_propuesta?.id ?? inc.id} inc={inc} nodo={nodo} coordinador={coordinador} onDecidido={onDecidido} />
        </aside>
      </div>
    </article>
  );
}

function Incertidumbre({ inc }: { inc: Incidente }) {
  const u = inc.incertidumbre;
  const listas: [string, Record<string, unknown>[]][] = [
    ["Contradicciones", u.contradicciones],
    ["Posiblemente el mismo incidente", u.posibles_mismo_incidente],
  ];
  return (
    <section className="panel" aria-labelledby="t-incertidumbre">
      <h2 id="t-incertidumbre">Incertidumbre</h2>
      <div className="confianza-fila">
        <InsigniaConfianza c={u.corroboracion} />
        <span>
          {u.dispositivos} dispositivo{u.dispositivos === 1 ? "" : "s"} · {u.fuentes_directas} testigo
          {u.fuentes_directas === 1 ? "" : "s"} directo{u.fuentes_directas === 1 ? "" : "s"}
        </span>
      </div>
      {(u.sin_analisis_ia || u.sin_ubicacion) && (
        <ul className="avisos">
          {u.sin_analisis_ia && <li>Sin análisis de IA: priorizado solo con reglas.</li>}
          {u.sin_ubicacion && <li>Sin ubicación.</li>}
        </ul>
      )}
      {u.motivos.length > 0 && (
        <>
          <h3>Motivos para revisar</h3>
          <ul className="lista">
            {u.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      {listas.map(([titulo, items]) =>
        items.length ? (
          <div key={titulo}>
            <h3>{titulo}</h3>
            <ul className="lista">
              {items.map((it, i) => (
                <li key={i}>
                  {Object.entries(it).map(([k, v]) => (
                    <span key={k} className="par">
                      <span className="tenue">{k.replaceAll("_", " ")}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {u.discrepancias_entre_centrales.length > 0 && (
        <>
          <h3>Las centrales no coinciden</h3>
          <ul className="lista">
            {u.discrepancias_entre_centrales.map((d) => (
              <li key={d.reporte_id}>
                <span className="mono">{d.reporte_id}</span>: {d.prioridades.join(" vs ")} (se muestra la más alta)
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ItemEvidencia({ ev, ahora }: { ev: Evidencia; ahora: number }) {
  return (
    <li className="evidencia">
      <div className="evidencia-cabeza">
        <InsigniaPrioridad p={ev.prioridad} />
        <span className="mono pequeno">{ev.reporte_id}</span>
        <span className="tenue pequeno">
          {horaLocal(ev.hora_unix)} · {haceCuanto(ev.hora_unix, ahora)}
        </span>
        <span className="separa" />
        <span className="pequeno">{ev.fuente ? FUENTE[ev.fuente] : "Fuente sin dato"}</span>
        <span className="pequeno tenue">
          {ev.vinculo === "nuevo" ? "Primer reporte" : "Mismo incidente"}
          {ev.similitud !== null && ` · ${Math.round(ev.similitud * 100)} % parecido`}
        </span>
      </div>
      <blockquote className="cita">{ev.texto || <em className="tenue">Sin texto</em>}</blockquote>
      <p className="pequeno tenue">
        {ev.personas} persona{ev.personas === 1 ? "" : "s"} · llegó por {ev.rutas} ruta{ev.rutas === 1 ? "" : "s"}
      </p>
      <ul className="senales" aria-label="Señales del triaje">
        {ev.senales.map((s, i) => (
          <li key={i} className="senal">
            <span className={`origen o-${s.origen}`}>{ORIGEN[s.origen]}</span>
            <span>{s.senal}</span>
            <InsigniaPrioridad p={s.prioridad} />
            {s.probabilidad !== null && <span className="mono pequeno">{Math.round(s.probabilidad * 100)} %</span>}
            {s.cita && <q className="senal-cita">{s.cita}</q>}
          </li>
        ))}
      </ul>
    </li>
  );
}
