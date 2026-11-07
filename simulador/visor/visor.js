// Visor del recorrido: lee /estado del simulador (solo agrega eventos) y dibuja la malla.
"use strict";

const NS = "http://www.w3.org/2000/svg";
const W = 1000, H = 650, MALLA = { x0: 40, x1: 700, y0: 40, y1: 610 };
const CENTRAL = { A: { x: 860, y: 220 }, B: { x: 860, y: 430 } };
const NOMBRES = ["Reporte", "Almacenamiento", "Transmisión", "Agentes", "Priorización", "Tablero", "Caída de nodo", "Recuperación"];
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

const svg = document.getElementById("malla");
svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
const capas = Object.fromEntries(["barrios", "enlaces", "caminos", "subidas", "nodos", "envios", "centrales"].map((n) => {
  const g = document.createElementNS(NS, "g");
  svg.appendChild(g);
  return [n, g];
}));

let pos = {};          // id de nodo → {x, y}
let proyectar = null;  // lon, lat → {x, y}
let visto = 0;         // eventos ya dibujados
let destacado = null;
const tienen = new Set();
const padre = {};      // celular → de quién recibió primero la copia del reporte que seguimos
const linea = { creado: null, malla: 0, central: null, entregado: false, saltos: 0 };
let barrios = null;

function el(tag, attrs, padre) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (padre) padre.appendChild(e);
  return e;
}

function armarProyeccion(nodos) {
  const lat0 = nodos.reduce((s, n) => s + n.lat, 0) / nodos.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = nodos.map((n) => n.lon * k), ys = nodos.map((n) => n.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const esc = Math.min((MALLA.x1 - MALLA.x0) / (maxX - minX), (MALLA.y1 - MALLA.y0) / (maxY - minY)) * 0.9;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const mx = (MALLA.x0 + MALLA.x1) / 2, my = (MALLA.y0 + MALLA.y1) / 2;
  return (lon, lat) => ({ x: mx + (lon * k - cx) * esc, y: my - (lat - cy) * esc });
}

function dentro([lon, lat], anillo) {
  let s = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) s = !s;
  }
  return s;
}

function dibujarBarrios(nodos) {
  if (!barrios) return;
  const centro = [nodos.reduce((s, n) => s + n.lon, 0) / nodos.length, nodos.reduce((s, n) => s + n.lat, 0) / nodos.length];
  for (const f of barrios.features) {
    const polis = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polis) {
      const d = p[0].map(([lon, lat], i) => { const q = proyectar(lon, lat); return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join("") + "Z";
      el("path", { d, class: "barrio-forma" }, capas.barrios);
    }
    if (polis.some((p) => dentro(centro, p[0]))) {
      const b = document.getElementById("barrio");
      b.textContent = `Barrio ${f.properties.name} · Manizales`;
      b.hidden = false;
    }
  }
}

function dibujarMalla(e) {
  proyectar = armarProyeccion(e.nodos);
  dibujarBarrios(e.nodos);
  for (const n of e.nodos) pos[n.id] = proyectar(n.lon, n.lat);
  for (const [a, b] of e.vecinos) el("line", { x1: pos[a].x, y1: pos[a].y, x2: pos[b].x, y2: pos[b].y, class: "enlace" }, capas.enlaces);
  for (const n of e.nodos) {
    const g = el("g", { class: `nodo${n.pasarela ? " pasarela" : ""}`, id: `n-${n.id}`, transform: `translate(${pos[n.id].x},${pos[n.id].y})` }, capas.nodos);
    if (n.pasarela) el("rect", { x: -10, y: -10, width: 20, height: 20, rx: 3 }, g);
    else el("circle", { r: 8 }, g);
    el("text", { x: 12, y: 4 }, g).textContent = n.pasarela ? `${n.id} · pasarela` : n.id;
  }
  for (const [nodo, c] of Object.entries(CENTRAL)) {
    const g = el("g", { class: "caja-central", id: `c-${nodo}`, transform: `translate(${c.x},${c.y})` }, capas.centrales);
    el("rect", { x: -70, y: -28, width: 140, height: 56, rx: 8 }, g);
    el("text", { x: 0, y: 5, "text-anchor": "middle" }, g).textContent = `Central ${nodo}`;
  }
}

function animar(de, a, clase) {
  if (quieto || capas.envios.childElementCount > 160) return;
  const p0 = pos[de], p1 = typeof a === "string" ? pos[a] : a;
  if (!p0 || !p1) return;
  const c = el("circle", { class: `envio ${clase}`, cx: p0.x, cy: p0.y }, capas.envios);
  const t0 = performance.now(), dur = 650;
  (function paso(t) {
    const f = Math.min(1, (t - t0) / dur);
    c.setAttribute("cx", p0.x + (p1.x - p0.x) * f);
    c.setAttribute("cy", p0.y + (p1.y - p0.y) * f);
    if (f < 1) requestAnimationFrame(paso); else c.remove();
  })(t0);
}

function clase(id, extra) {
  document.getElementById(`n-${id}`)?.classList.add(extra);
}

function aplicar(ev) {
  switch (ev.tipo) {
    case "creado":
      if (ev.id === destacado) { clase(ev.nodo, "reportante"); tienen.add(ev.nodo); linea.creado = ev.nodo; }
      break;
    case "salto":
      for (const v of ev.a) {
        animar(ev.de, v, ev.prioridad.toLowerCase());
        if (ev.id === destacado && !tienen.has(v)) {
          // La malla reparte por inundación: muchas copias (tenues) y un solo camino que llega.
          tienen.add(v);
          padre[v] = ev.de;
          clase(v, "tiene");
          el("line", { x1: pos[ev.de].x, y1: pos[ev.de].y, x2: pos[v].x, y2: pos[v].y, class: "copia" }, capas.caminos);
        }
      }
      if (ev.id === destacado) linea.malla = Math.max(linea.malla, ev.intento);
      break;
    case "sack":
      for (const v of ev.a) animar(ev.de, v, "sack");
      break;
    case "subida": {
      const destino = ev.fallo ? "fallo" : ev.central;
      const c = CENTRAL[ev.central] ?? CENTRAL.A;
      const l = el("line", { x1: pos[ev.pasarela].x, y1: pos[ev.pasarela].y, x2: c.x - 70, y2: c.y, class: `subida ${destino}` }, capas.subidas);
      setTimeout(() => l.remove(), 1200);
      if (ev.ids.includes(destacado) && !linea.central) {
        linea.central = ev.central;
        // El camino que entregó: de la pasarela hacia atrás por quien le pasó cada copia.
        for (let n = ev.pasarela; padre[n]; n = padre[n]) {
          el("line", { x1: pos[padre[n]].x, y1: pos[padre[n]].y, x2: pos[n].x, y2: pos[n].y, class: "camino" }, capas.caminos);
          linea.saltos += 1;
        }
      }
      break;
    }
    case "confirmado":
      if (ev.id === destacado) { linea.entregado = true; clase(ev.nodo, "entregado"); }
      break;
    case "apagado":
      clase(ev.nodo, "apagado");
      break;
  }
}

function pintarPanel(e) {
  document.getElementById("reloj").textContent = `t = ${e.t} s`;
  document.getElementById("pasos").innerHTML = NOMBRES.map((n, i) => {
    const k = i + 1, c = k < e.paso ? "hecho" : k === e.paso ? "actual" : "";
    return `<li class="${c}" title="${n}" ${k === e.paso ? 'aria-current="step"' : ""}>${k}</li>`;
  }).join("");
  document.getElementById("paso-num").textContent = e.paso >= 1 && e.paso <= 8 ? `Paso ${e.paso} de 8` : e.paso > 8 ? "Fin" : "Preparando";
  document.getElementById("paso-titulo").textContent = e.titulo;
  const ul = document.getElementById("paso-detalle");
  ul.replaceChildren(...e.detalle.map((d) => Object.assign(document.createElement("li"), { textContent: d })));

  const ultima = [...e.eventos].reverse().find((x) => x.tipo === "subida" && !x.fallo)?.central;
  document.getElementById("centrales").innerHTML = ["A", "B"].map((n) => {
    const caida = e.centrales[n] === "caida";
    document.getElementById(`c-${n}`)?.classList.toggle("caida", caida);
    return `<span class="central${caida ? " caida" : ""}${ultima === n ? " activa" : ""}"><i></i>Central ${n} · ${caida ? "caída" : "en línea"}</span>`;
  }).join("");

  if (destacado) {
    document.getElementById("destacado").hidden = false;
    const creado = e.eventos.find((x) => x.tipo === "creado" && x.id === destacado);
    if (creado) document.getElementById("d-linea").textContent = `${creado.linea}  (${creado.bytes} bytes)`;
    const pasos = [
      [linea.creado, `Guardado en ${linea.creado ?? "el celular"} como pendiente`],
      [linea.malla > 0, `En la malla${tienen.size > 1 ? ` · ${tienen.size - 1} celulares con copia` : ""}`],
      [linea.central, `En la central ${linea.central ?? ""}${linea.saltos ? ` · ${linea.saltos} saltos` : ""}`],
      [linea.entregado, "SACK de vuelta: «entregado»"],
    ];
    document.getElementById("d-estado").innerHTML = pasos.map(([si, t]) => `<li class="${si ? "si" : ""}">${t}</li>`).join("");
  }
  const c = e.cuentas;
  document.getElementById("cuentas").innerHTML =
    `<div><dt>Reportes</dt><dd>${c.creados}</dd></div><div><dt>En la central</dt><dd>${c.en_central}</dd></div><div><dt>Entregados</dt><dd>${c.entregados}</dd></div>`;
  document.getElementById("siguiente").disabled = e.paso > 8;
}

async function sondear() {
  try {
    const r = await fetch(`/estado?desde=${visto}`, { cache: "no-store" });
    const e = await r.json();
    if (!proyectar && e.nodos.length) dibujarMalla(e);
    destacado = e.destacado;
    for (const ev of e.eventos) aplicar(ev);
    visto = e.n;
    pintarPanel({ ...e, eventos: e.eventos });
  } catch {
    document.getElementById("paso-titulo").textContent = "El recorrido terminó o el simulador no responde";
  }
  setTimeout(sondear, 400);
}

document.getElementById("siguiente").addEventListener("click", () => fetch("/siguiente", { method: "POST" }));
fetch("/barrios.geojson").then((r) => r.json()).then((b) => (barrios = b)).catch(() => {}).finally(sondear);
