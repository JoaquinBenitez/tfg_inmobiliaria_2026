# Imagen de la API — Node 22 (glibc) por sharp
FROM node:22-bookworm-slim

WORKDIR /app

# Fuentes mínimas: sin ellas, el texto de los SVG (placeholders de la semilla)
# se rasteriza vacío en slim (solo se ve el gradiente)
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias primero (capa cacheada mientras package*.json no cambie)
COPY package.json package-lock.json ./
RUN npm ci

# Resto del código (los .env* quedan fuera vía .dockerignore; la config llega
# por variables de entorno del orquestador)
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
