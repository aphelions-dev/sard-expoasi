import { Moon, Sun, UserRound } from "lucide-react";
import type { Nodo } from "../api/central";
import type { Salud } from "../api/tipos";

interface Props {
  saludes: Record<Nodo, Salud | null> | null;
  activa: Nodo | null;
  coordinador: string;
  onCoordinador: (v: string) => void;
  tema: string;
  onTema: () => void;
  pendientes: number;
}

function Nodo({ nombre, ok, activa }: { nombre: string; ok: boolean | null; activa?: boolean }) {
  const estado = ok === null ? "comprobando" : ok ? "en línea" : "caída";
  return (
    <span className={`nodo ${ok === null ? "n-espera" : ok ? "n-ok" : "n-caido"}${activa ? " activa" : ""}`}>
      <span className="punto" aria-hidden="true" />
      <span className="nodo-nombre">{nombre}</span>
      <span className="nodo-estado">{estado}</span>
      {activa && <span className="nodo-activa">leyendo</span>}
    </span>
  );
}

export function BarraSuperior({ saludes, activa, coordinador, onCoordinador, tema, onTema, pendientes }: Props) {
  const jev = activa && saludes?.[activa] ? saludes[activa]!.jev === "ok" : null;
  return (
    <header className="barra">
      <div className="marca">
        <span className="marca-logo" aria-hidden="true">S</span>
        <div>
          <h1>SARD</h1>
          <p>Tablero del coordinador</p>
        </div>
      </div>

      <div className="barra-estado" role="status" aria-live="polite">
        <Nodo nombre="Central A" ok={saludes ? !!saludes.A : null} activa={activa === "A"} />
        <Nodo nombre="Central B" ok={saludes ? !!saludes.B : null} activa={activa === "B"} />
        <span className={`nodo ${jev === null ? "n-espera" : jev ? "n-ok" : "n-aviso"}`}>
          <span className="punto" aria-hidden="true" />
          <span className="nodo-nombre">Jev</span>
          <span className="nodo-estado">{jev === null ? "sin dato" : jev ? "en línea" : "caído · solo reglas"}</span>
        </span>
      </div>

      <div className="barra-acciones">
        <span className="pendientes" title="Incidentes con acción propuesta esperando tu decisión">
          <strong>{pendientes}</strong> por decidir
        </span>
        <label className="coordinador">
          <UserRound size={16} aria-hidden="true" />
          <span className="solo-lector">Coordinador</span>
          <input
            value={coordinador}
            onChange={(e) => onCoordinador(e.target.value)}
            placeholder="Tu nombre"
            aria-label="Nombre del coordinador"
            maxLength={60}
          />
        </label>
        <button className="boton-icono" onClick={onTema} aria-label={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}>
          {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
