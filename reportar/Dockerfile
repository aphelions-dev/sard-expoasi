# App web de reportes: se compila a archivos estáticos y los sirve nginx. Las URLs de las centrales
# quedan fijas en la compilación (NEXT_PUBLIC_*): por defecto, localhost:8001 y :8002, donde Docker
# publica las centrales. En Railway llegan como variables del servicio (ARG).
FROM node:24-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CENTRAL_A_URL=http://localhost:8001
ARG NEXT_PUBLIC_CENTRAL_B_URL=http://localhost:8002
RUN npm run build

FROM nginx:1.29-alpine
# El service worker no se guarda en caché del navegador: así una versión nueva llega al recargar.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location = /sw.js { add_header Cache-Control "no-cache"; }\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
COPY --from=compilar /app/out /usr/share/nginx/html
