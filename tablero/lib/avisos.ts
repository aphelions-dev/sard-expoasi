"use client"

// Avisos fuera de la página: un tono al llegar algo nuevo y una notificación del sistema cuando la
// pestaña no está a la vista. El navegador solo deja sonar después de un clic en la página y solo
// muestra notificaciones con permiso, así que ambos fallan en silencio si no los tienen.

let contexto: AudioContext | null = null

/** Crea o reanuda el audio. Se llama desde un clic: antes de eso el navegador lo tiene en pausa. */
export function prepararSonido() {
  try {
    contexto ??= new AudioContext()
    if (contexto.state === "suspended") void contexto.resume()
  } catch {
    contexto = null
  }
}

/** Dos notas cortas; P1 sube de tono y se repite, para que se distinga sin mirar. */
export function tono(p1: boolean) {
  if (!contexto || contexto.state !== "running") return
  const notas = p1 ? [880, 1175, 880, 1175] : [660, 880]
  const t0 = contexto.currentTime
  notas.forEach((f, i) => {
    const osc = contexto!.createOscillator()
    const vol = contexto!.createGain()
    osc.type = "sine"
    osc.frequency.value = f
    const t = t0 + i * 0.16
    vol.gain.setValueAtTime(0.0001, t)
    vol.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(vol).connect(contexto!.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  })
}

/** Pide permiso para notificar. Desde un clic: el navegador ignora el pedido sin uno. */
export function pedirPermisoNotificar() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  )
    void Notification.requestPermission()
}

/** Notifica solo si la pestaña está oculta: con el tablero a la vista sobran los avisos de la página. */
export function notificar(titulo: string, cuerpo: string) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !document.hidden
  )
    return
  const n = new Notification(titulo, {
    body: cuerpo,
    tag: "sard-llegada",
    icon: "/favicon.svg",
  })
  n.onclick = () => {
    window.focus()
    n.close()
  }
}
