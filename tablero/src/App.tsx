import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Ban, FileText, Map as IconoMapa, Truck } from "lucide-react";
import { elegirActiva, incidentes, rechazados, recursos, salud, type Nodo } from "./api/central";
import type { Incidente, Rechazado, Recurso, Salud } from "./api/tipos";
import { porDecidir, type Filtro } from "./cola";
import { BarraSuperior } from "./componentes/BarraSuperior";
import { Cola } from "./componentes/Cola";
import { Detalle } from "./componentes/Detalle";
import { Rechazados } from "./componentes/Rechazados";
import { Recursos } from "./componentes/Recursos";
import { barrioDe, cargarGeo, type Barrio, type Geo } from "./geo/geo";
import { usarPreferencia, usarSondeo } from "./usarSondeo";

// MapLibre pesa ~1 MB: se baja solo al abrir el mapa, no para ver la cola.
const Mapa = lazy(() => import("./componentes/Mapa").then((m) => ({ default: m.Mapa })));

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
  const [vista, setVista] = usarPreferencia("sard.vista", "incidente");
  const [geo, setGeo] = useState<Geo | null>(null);

  useEffect(() => {
    cargarGeo().then(setGeo, () => setGeo(null)); // sin archivos geo, el tablero sigue sin mapa
  }, []);

  const barrio = useCallback(
    (gh: string | null): Barrio | null => (geo && gh ? barrioDe(geo.barrios, gh) : null),
    [geo],
  );

  const saludes = usarSondeo(leerSaludes, CADA_MS);
  const activa = saludes.datos ? elegirActiva(saludes.datos) : null;
  const lista = usarSondeo<Incidente[] | null>(() => (activa ? incidentes(activa) : Promise.resolve(null)), CADA_MS);
  const recs = usarSondeo<Recurso[] | null>(() => (activa ? recursos(activa) : Promise.resolve(null)), CADA_MS);
  const rech = usarSondeo<Rechazado[] | null>(() => (activa ? rechazados(activa) : Promise.resolve(null)), CADA_MS);

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
  const sinRecuperar = rech.datos?.filter((r) => !r.recuperado).length ?? 0;
  const enMapa = vista === "mapa" && !!geo;

  // En pantallas angostas la cola y la zona derecha se alternan: otra pestaña muestra la zona.
  function irA(v: string) {
    setVista(v);
    setVerDetalle(v !== "incidente");
  }
  const volver = () => irA("incidente");
  const VISTAS = [
    { id: "incidente", etiqueta: "Incidente", icono: FileText, n: 0 },
    ...(geo ? [{ id: "mapa", etiqueta: "Mapa", icono: IconoMapa, n: 0 }] : []),
    { id: "recursos", etiqueta: "Recursos", icono: Truck, n: 0 },
    { id: "rechazados", etiqueta: "Rechazados", icono: Ban, n: sinRecuperar },
  ];

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

      <nav className="vistas" role="tablist" aria-label="Vista">
        {VISTAS.map((v) => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={vista === v.id ? "activo" : ""} onClick={() => irA(v.id)}>
            <v.icono size={15} aria-hidden="true" /> {v.etiqueta}
            {v.n > 0 && <span className="vistas-n" aria-label={`${v.n} sin recuperar`}>{v.n}</span>}
          </button>
        ))}
      </nav>

      <main className={`principal${verDetalle ? " con-detalle" : ""}`}>
        <Cola
          incidentes={incs}
          filtro={filtro}
          onFiltro={setFiltro}
          seleccion={elegido?.id ?? null}
          onSeleccion={(id) => {
            setSeleccion(id);
            if (vista !== "incidente" && vista !== "mapa") setVista("incidente");
            setVerDetalle(true);
          }}
          ahora={ahora}
          barrio={barrio}
        />
        <div id="principal" className={`zona-detalle${enMapa ? " en-mapa" : ""}`} tabIndex={-1}>
          {vista === "recursos" ? (
            <Recursos
              declarados={recs.datos}
              incidentes={incs}
              nodo={activa}
              coordinador={coordinador}
              ahora={ahora}
              onDeclarado={() => {
                recs.refrescar();
                refrescar();
              }}
              onVolver={volver}
            />
          ) : vista === "rechazados" ? (
            <Rechazados lista={rech.datos} ahora={ahora} onVolver={volver} />
          ) : enMapa ? (
            <Suspense fallback={<p className="vacio">Cargando mapa…</p>}>
              <Mapa
                geo={geo}
                incidentes={incs}
                seleccion={elegido?.id ?? null}
                onSeleccion={(id) => setSeleccion(id)}
                tema={tema}
              />
            </Suspense>
          ) : elegido ? (
            <Detalle
              inc={elegido}
              nodo={activa}
              coordinador={coordinador}
              ahora={ahora}
              geo={geo}
              barrio={barrio(elegido.geohash)}
              onDecidido={() => {
                refrescar();
                recs.refrescar();
              }}
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
