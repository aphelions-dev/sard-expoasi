// Puntos que en pantalla quedarían uno encima de otro se juntan en un racimo. La distancia se mide
// en metros y el radio sale del zoom: al acercarse, el racimo se abre solo.
import { metros } from "./geo";

/** Metros que ocupa un pixel a ese zoom y latitud (teselas de 512 px, las de MapLibre). */
export function metrosPorPixel(zoom: number, latitud: number): number {
  return (78271.517 * Math.cos((latitud * Math.PI) / 180)) / 2 ** zoom;
}

export interface Racimo<T> {
  /** El sitio del primero que entró: con la lista ordenada por gravedad, el más grave. */
  centro: [number, number];
  datos: T[];
  /** Metros del centro al miembro más lejano: 0 si todos están en el mismo sitio. */
  radio: number;
}

/** Junta cada punto con el primer racimo que tenga a menos de `radioM`; si no hay, abre uno. El
 *  orden de entrada decide el centro, así que el resultado no baila entre lecturas. */
export function racimos<T>(puntos: { centro: [number, number]; dato: T }[], radioM: number): Racimo<T>[] {
  const out: Racimo<T>[] = [];
  for (const p of puntos) {
    const r = out.find((x) => metros(x.centro, p.centro) <= radioM);
    if (r) {
      r.datos.push(p.dato);
      r.radio = Math.max(r.radio, metros(r.centro, p.centro));
    } else {
      out.push({ centro: p.centro, datos: [p.dato], radio: 0 });
    }
  }
  return out;
}
