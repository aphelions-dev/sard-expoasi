"""Calibración del umbral de Jev con los reportes etiquetados a mano (#13).

    uv run --env-file ../.env python -m calibracion.correr
    uv run --env-file ../.env python -m calibracion.correr --csv otra/ruta.csv

Lee `datos/sinteticos/reportes_etiquetados.csv` (columnas `id,texto,tipo_real,prioridad_real,
atrapados,heridos,notas`), le pregunta a Jev una vez por reporte y guarda las respuestas en
`calibracion/respuestas-jev.json`: si se corre otra vez, solo consulta los textos nuevos. Después
prueba varios umbrales de «sí» con la misma regla del triaje (`agente.senales_jev`) y escribe
`calibracion/resultados.md`.

No cambia `agentes/triaje/jev.py`: recomienda un umbral y la decisión la toma el equipo.

Cómo se arma cada reporte: prioridad del celular P4 (neutra) y las banderas de las columnas
`atrapados` y `heridos`, para medir lo que aporta la central sobre el formulario.
"""

import csv
import hashlib
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

from agentes.triaje import agente, jev, reglas

CSV = Path(__file__).parents[2] / "datos" / "sinteticos" / "reportes_etiquetados.csv"
CACHE = Path(__file__).parent / "respuestas-jev.json"
SALIDA = Path(__file__).parent / "resultados.md"
UMBRALES = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]
PRIORIDADES = ("P1", "P2", "P3", "P4")
SI = {"1", "si", "sí", "true", "x"}


def leer_csv(ruta: Path) -> tuple[list[dict[str, Any]], list[str]]:
    """Filas válidas y avisos de las que se saltaron."""
    filas, avisos = [], []
    with open(ruta, encoding="utf-8", newline="") as f:
        for n, fila in enumerate(csv.DictReader(f), start=2):
            if fila.get("prioridad_real", "").strip() not in PRIORIDADES:
                avisos.append(f"línea {n}: prioridad_real inválida {fila.get('prioridad_real')!r}")
                continue
            filas.append({
                "id": fila["id"].strip(), "texto": fila["texto"].strip(),
                "tipo_real": fila.get("tipo_real", "").strip(),
                "prioridad_real": fila["prioridad_real"].strip(),
                "atrapados": fila.get("atrapados", "").strip().lower() in SI,
                "heridos": fila.get("heridos", "").strip().lower() in SI,
            })
    return filas, avisos


def _clave(texto: str) -> str:
    return hashlib.sha256(f"{jev.MODELO}|{texto}".encode()).hexdigest()[:16]


def respuestas(filas: list[dict], cliente: jev.Jev, cache: Path = CACHE) -> dict[str, dict]:
    """Respuesta de Jev por texto, con caché por modelo y texto. Un fallo queda como None."""
    guardadas = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    for f in filas:
        k = _clave(f["texto"])
        if k in guardadas or not f["texto"]:
            continue
        try:
            r = cliente.evaluar(f["texto"])
        except Exception as e:  # se informa y se puede volver a correr
            print(f"Jev falló con {f['id']}: {e!r}")
            continue
        guardadas[k] = {"nouls": r.nouls, "tipo": r.tipo, "tipo_probabilidad": r.tipo_probabilidad}
        cache.write_text(json.dumps(guardadas, ensure_ascii=False, indent=1), encoding="utf-8")
    return {f["id"]: guardadas.get(_clave(f["texto"])) for f in filas}


def prioridad_reglas(f: dict) -> str:
    rep = {"prioridad": "P4", "atrapados": f["atrapados"], "heridos": f["heridos"],
           "texto": f["texto"]}
    return agente.mas_alta(*(s.prioridad for s in reglas.senales(rep)))


def evaluar(filas: list[dict], resp: dict[str, dict | None], si: float | None) -> dict[str, Any]:
    """Métricas con el umbral `si`; `None` es solo reglas (Jev caído)."""
    sub, sobre, subio = [], [], 0
    p1_real = p1_bien = 0
    for f in filas:
        p_reglas = prioridad_reglas(f)
        final = p_reglas
        r = resp.get(f["id"])
        if si is not None and r:
            subidas = [s.prioridad for s in agente.senales_jev(r["nouls"], si)]
            final = agente.mas_alta(p_reglas, *subidas)
            subio += final < p_reglas
        if final > f["prioridad_real"]:
            sub.append(f["id"])
        elif final < f["prioridad_real"]:
            sobre.append(f["id"])
        if f["prioridad_real"] == "P1":
            p1_real += 1
            p1_bien += final == "P1"
    return {"si": si, "subtriaje": sub, "sobretriaje": sobre, "jev_subio": subio,
            "exactas": len(filas) - len(sub) - len(sobre),
            "recall_p1": p1_bien / p1_real if p1_real else None}


def recomendar(barrido: list[dict]) -> float:
    """Menos subtriaje primero (el error grave); luego menos sobretriaje; luego el más cercano al actual."""
    return min(barrido, key=lambda m: (len(m["subtriaje"]), len(m["sobretriaje"]),
                                       abs(m["si"] - jev.SI)))["si"]


def tipo_acierto(filas: list[dict], resp: dict[str, dict | None]) -> tuple[int, int]:
    con = [(f, resp[f["id"]]) for f in filas if resp.get(f["id"]) and f["tipo_real"]]
    return sum(r["tipo"] == f["tipo_real"] for f, r in con), len(con)


def informe(filas, resp, avisos, ruta_csv) -> str:
    barrido = [evaluar(filas, resp, si) for si in UMBRALES]
    base = evaluar(filas, resp, None)
    rec = recomendar(barrido)
    sin_resp = sum(1 for f in filas if f["texto"] and not resp.get(f["id"]))
    bien, total = tipo_acierto(filas, resp)

    def pct(x):
        return "—" if x is None else f"{x:.0%}"

    l = ["# Calibración del umbral de Jev\n",
         f"Corrida del {date.today().isoformat()} · `{jev.MODELO}` · {len(filas)} reportes de "
         f"`{ruta_csv.name}`. Umbral actual: {jev.SI}. Formulario: P4 y las banderas del CSV.\n",
         "| Umbral | Subtriaje | Sobretriaje | Exactas | Recall P1 | Jev subió |",
         "|---|---|---|---|---|---|",
         f"| solo reglas | {len(base['subtriaje'])} | {len(base['sobretriaje'])} | {base['exactas']} "
         f"| {pct(base['recall_p1'])} | — |"]
    for m in barrido:
        marca = " **(recomendado)**" if m["si"] == rec else ""
        actual = " (actual)" if m["si"] == jev.SI else ""
        l.append(f"| {m['si']}{actual}{marca} | {len(m['subtriaje'])} | {len(m['sobretriaje'])} "
                 f"| {m['exactas']} | {pct(m['recall_p1'])} | {m['jev_subio']} |")
    m = next(x for x in barrido if x["si"] == rec)
    l += ["", "Subtriaje: la central deja el reporte por debajo de su prioridad real (el error grave).",
          "Se recomienda el umbral con menos subtriaje; si empatan, el de menos sobretriaje.", "",
          f"Con {rec}: subtriaje en {', '.join(m['subtriaje']) or 'ninguno'}; "
          f"sobretriaje en {', '.join(m['sobretriaje']) or 'ninguno'}.", "",
          f"Tipo de emergencia según Jev: {bien} de {total} coinciden con `tipo_real`."]
    if sin_resp:
        l.append(f"\n{sin_resp} reportes sin respuesta de Jev (fallo o sin clave): cuentan como solo reglas.")
    if avisos:
        l += ["", "Filas saltadas:", *[f"- {a}" for a in avisos]]
    l += ["", "Para adoptar el umbral, cambiar `SI` en `agentes/triaje/jev.py` y anotarlo en la ficha de triaje."]
    return "\n".join(l) + "\n"


def main() -> None:
    ruta = Path(sys.argv[sys.argv.index("--csv") + 1]) if "--csv" in sys.argv else CSV
    filas, avisos = leer_csv(ruta)
    if not filas:
        raise SystemExit(f"{ruta} no tiene reportes etiquetados todavía (#13).")
    cliente = jev.Jev()
    if not cliente.disponible:
        raise SystemExit("Falta JEV_API_KEY; usa --env-file ../.env")
    texto = informe(filas, respuestas(filas, cliente), avisos, ruta)
    SALIDA.write_text(texto, encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
