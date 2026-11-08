# Tablero: se compila a archivos estáticos y los sirve nginx. Las URLs de las centrales quedan fijas
# en la compilación (NEXT_PUBLIC_*): por defecto, localhost:8001 y :8002, que es donde Docker publica
# las centrales para el navegador.
FROM node:24-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CENTRAL_A_URL=http://localhost:8001
ARG NEXT_PUBLIC_CENTRAL_B_URL=http://localhost:8002
RUN npm run build

FROM nginx:1.29-alpine
# nginx no conoce .mjs y lo sirve como application/octet-stream: el navegador rechaza así el worker
# de MapLibre (public/vendor/) y el mapa queda sin barrios ni zonas.
RUN sed -i 's|^\( *application/javascript *\)js;|\1js mjs;|' /etc/nginx/mime.types
COPY --from=compilar /app/out /usr/share/nginx/html
