# 0007 — iPhone: bitchat oficial de relevo y app web para reportar

**Estado:** aceptada · reemplaza en parte a la 0002

**Contexto:** la 0002 dejó la app solo para Android. En una emergencia buena parte de los
celulares a la mano serán iPhone, y la pregunta fue si una app web que funcione sin internet
podía cubrirlos. Lo que se encontró (noviembre de 2026):

- Safari en iOS no implementa Web Bluetooth en ninguna versión (caniuse, MDN). Aunque lo
  implementara, la API solo se conecta a un periférico: no puede anunciarse para que otros la
  encuentren (WebBluetoothCG/web-bluetooth #231). Una página web no puede ser un nodo de la malla.
- Safari no tiene Background Sync: una página guarda un reporte sin internet, pero solo lo sube
  cuando alguien la vuelve a abrir con conexión.
- bitchat sí existe para iOS (App Store, permissionlesstech/bitchat), y el port de Android dice ser
  «fully protocol-compatible» con él. Los `SARD1` y `SACK` viajan como mensajes públicos de bitchat
  (`contracts/protocolo-sard1.md`, «Transporte en la malla»).

**Decisión:** el iPhone entra de dos formas, sin código Swift:

1. **Relevo con el bitchat oficial.** Un iPhone con bitchat reenvía los mensajes públicos y con
   ellos los `SARD1`. Los muestra en el chat, porque no conoce SARD, y no tiene el formulario.
2. **App web para reportar** (`tablero/app/reportar/`, en `/reportar/`). Arma el mismo `SARD1`
   que la app Android, con las mismas reglas de prioridad y la misma lista de palabras críticas.
   Lo guarda en el navegador, abre sin internet (service worker) y lo sube a la central como su
   propia pasarela (`POST /reportes`, A y si no B, `pasarela_id` = `web-<disp>`). Sin internet,
   «Copiar para bitchat» deja el mensaje listo para pegarlo en el chat público de bitchat, y así
   entra a la malla.

Android sigue siendo la app completa: la única que es reportante, relevo y pasarela a la vez.

**Consecuencias:**

- Volver a tener internet hace en la web lo que en la malla hace un vecino nuevo: los reportes
  vencidos empiezan una ronda nueva (regla 5).
- La web reintenta solo mientras la página esté abierta, y la página lo dice.
- **Por definir:**
  - Probar con un iPhone real que bitchat iOS reenvía un `SARD1` entre dos Android, y que un
    `SARD1` pegado a mano en su chat llega a la central.
  - El despliegue con HTTPS. En un celular, el service worker y la ubicación solo funcionan en
    HTTPS (o en `localhost`), y la central también tendría que ir en HTTPS para que el navegador
    acepte la llamada. Mientras tanto, la web sirve en la demo desde el computador.
