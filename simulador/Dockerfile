# Simulador de la malla, sin dependencias. En Docker carga reportes sintéticos en las centrales
# (`correr --central`). Se construye desde la raíz del repo: el simulador lee ../datos y escribe en
# ../pruebas/resultados, así que se respeta esa estructura.
FROM python:3.12-slim
ENV PYTHONUTF8=1 PYTHONUNBUFFERED=1
WORKDIR /repo/simulador
COPY datos /repo/datos
COPY simulador/simulador /repo/simulador/simulador
RUN mkdir -p /repo/pruebas/resultados
ENTRYPOINT ["python", "-m", "simulador"]
CMD ["correr", "--central", "--velocidad", "20"]
