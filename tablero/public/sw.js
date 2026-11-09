// Service worker de /reportar/: guarda la página y sus archivos para que abra sin internet.
// Las llamadas a la central no pasan por aquí (son de otro origen) y nunca se guardan.
const CACHE = "sard-reportar-v1"
const BASE = ["/reportar/", "/palabras-criticas.txt", "/reportar.webmanifest", "/favicon.svg"]

// La página se guarda junto con los scripts y estilos que pide, para que la primera visita ya
// deje todo lo necesario.
async function guardarTodo() {
  const cache = await caches.open(CACHE)
  await cache.addAll(BASE)
  const html = await (await cache.match("/reportar/")).text()
  const recursos = [...html.matchAll(/(?:src|href)="(\/_next\/[^"]+)"/g)].map((m) => m[1])
  await cache.addAll([...new Set(recursos)])
}

self.addEventListener("install", (e) => e.waitUntil(guardarTodo().then(() => self.skipWaiting())))

self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
)

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return
  // La página y la lista, de la red primero (así se actualizan) y de la copia sin internet.
  if (e.request.mode === "navigate" || url.pathname === "/palabras-criticas.txt") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone()
          caches.open(CACHE).then((c) => c.put(url.pathname === "/palabras-criticas.txt" ? url.pathname : "/reportar/", copia))
          return r
        })
        .catch(() => caches.match(url.pathname === "/palabras-criticas.txt" ? url.pathname : "/reportar/"))
    )
    return
  }
  // Los archivos de /_next/static no cambian (llevan hash): de la copia si está.
  e.respondWith(
    caches.match(e.request).then(
      (c) =>
        c ||
        fetch(e.request).then((r) => {
          if (r.ok && url.pathname.startsWith("/_next/")) {
            const copia = r.clone()
            caches.open(CACHE).then((cache) => cache.put(e.request, copia))
          }
          return r
        })
    )
  )
})
