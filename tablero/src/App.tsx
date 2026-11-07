import { useEffect, useState } from "react";
import { elegirActiva, incidentes, salud, type Nodo } from "./api/central";
import type { Incidente, Salud } from "./api/tipos";
import { porDecidir, type Filtro } from "./cola";
import { BarraSuperior } from "./componentes/BarraSuperior";
import { Cola } from "./componentes/Cola";
import { Detalle } from "./componentes/Detalle";
import { usarPreferencia, usarSondeo } from "./usarSondeo";

const CADA_MS = 3000;

async function leerSaludes(): Promise<Record<Nodo, Salud | null>> {
  const [A, B] = await Promise.all([salud("A"), salud("B")]);
  return { A, B };
}

export function App() {
  const [tema, setTema] = usarPreferencia("sard.tema", "dark");
  const [coordinador, setCoordinador] = usarPreferencia("sard.coordinador", "");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [verDetalle, setVerDetalle] = useState(false); // en pantallas angostas
  const [ahora, setAhora] = useState(() => Date.now() / 1000);

  const saludes = usarSondeo(leerSaludes, CADA_MS);
  const activa = saludes.datos ? elegirActiva(saludes.datos) : null;
  const lista = usarSondeo<Incidente[] | null>(() => (activa ? incidentes(activa) : Promise.resolve(null)), CADA_MS);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now() / 1000), 30_000);
    return () => clearInterval(t);
  }, []);

  // Al cambiar de central, leer enseguida en vez de esperar el siguiente ciclo.
  const { refrescar } = lista;
  useEffect(() => {
    if (activa) refrescar();
  }, [activa, refrescar]);

  const incs = lista.datos ?? [];
  const elegido = incs.find((i) => i.id === seleccion) ?? incs[0] ?? null;

  return (
    <div className="app">
      <a className="saltar" href="#principal">
        Ir al incidente
      </a>
      <BarraSuperior
        saludes={saludes.datos}
        activa={activa}
        coordinador={coordinador}
        onCoordinador={setCoordinador}
        tema={tema}
        onTema={() => setTema(tema === "dark" ? "light" : "dark")}
        pendientes={porDecidir(incs)}
      />

      {saludes.datos && !activa && (
        <p className="banda error" role="alert">
          Ninguna central responde. Lo último que se mostró puede estar desactualizado.
        </p>
      )}
      {activa === "B" && (
        <p className="banda aviso" role="status">
          La central A no responde: leyendo de la central B.
        </p>
      )}

      <main className={`principal${verDetalle ? " con-detalle" : ""}`}>
        <Cola
          incidentes={incs}
          filtro={filtro}
          onFiltro={setFiltro}
          seleccion={elegido?.id ?? null}
          onSeleccion={(id) => {
            setSeleccion(id);
            setVerDetalle(true);
          }}
          ahora={ahora}
        />
        <div id="principal" className="zona-detalle" tabIndex={-1}>
          {elegido ? (
            <Detalle
              inc={elegido}
              nodo={activa}
              coordinador={coordinador}
              ahora={ahora}
              onDecidido={refrescar}
              onVolver={() => setVerDetalle(false)}
            />
          ) : (
            <p className="vacio">{lista.datos === null && !lista.error ? "Cargando…" : "Elige un incidente de la cola."}</p>
          )}
        </div>
      </main>
    </div>
  );
}
