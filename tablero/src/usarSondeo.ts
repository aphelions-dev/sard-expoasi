import { useCallback, useEffect, useRef, useState } from "react";

/** Llama a `leer` ya y cada `cadaMs`. `refrescar()` fuerza una lectura (p. ej. tras aprobar). */
export function usarSondeo<T>(leer: () => Promise<T>, cadaMs: number) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ultima, setUltima] = useState<number | null>(null);
  const leerRef = useRef(leer);
  leerRef.current = leer;

  const refrescar = useCallback(async () => {
    try {
      setDatos(await leerRef.current());
      setError(null);
      setUltima(Date.now());
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    refrescar();
    const t = setInterval(refrescar, cadaMs);
    return () => clearInterval(t);
  }, [refrescar, cadaMs]);

  return { datos, error, ultima, refrescar };
}

/** Preferencia del navegador; si el almacenamiento falla, la página sigue igual. */
export function usarPreferencia(clave: string, inicial: string) {
  const [valor, setValor] = useState(() => {
    try {
      return localStorage.getItem(clave) ?? inicial;
    } catch {
      return inicial;
    }
  });
  const guardar = useCallback(
    (v: string) => {
      setValor(v);
      try {
        localStorage.setItem(clave, v);
      } catch {
        /* sin almacenamiento: queda solo en memoria */
      }
    },
    [clave],
  );
  return [valor, guardar] as const;
}
