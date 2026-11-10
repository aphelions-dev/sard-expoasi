# Una central completa (API + cuatro agentes) en un contenedor. El nodo (A o B) va en el comando.
# Se construye desde la raíz del repo: el triaje lee contracts/palabras-criticas.txt, que es parte
# del contrato, así que se respeta la estructura central/ + contracts/.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /bin/uv
WORKDIR /repo/central
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUTF8=1 PYTHONUNBUFFERED=1
COPY central/pyproject.toml central/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY contracts /repo/contracts
COPY central .
ENV PATH="/repo/central/.venv/bin:$PATH"
CMD ["python", "iniciar.py", "A"]
