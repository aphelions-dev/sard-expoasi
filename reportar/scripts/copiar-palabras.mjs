// Copia contracts/palabras-criticas.txt a public/, de donde la lee la app web de reportes. La copia
// queda en el repo porque la imagen de Docker se construye solo con reportar/ y no ve contracts/;
// la prueba de lib/reportar.test.ts avisa si se desincroniza.
import { copyFileSync, existsSync } from "node:fs"

const origen = new URL("../../contracts/palabras-criticas.txt", import.meta.url)
if (existsSync(origen)) copyFileSync(origen, new URL("../public/palabras-criticas.txt", import.meta.url))
