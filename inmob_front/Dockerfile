# Imagen del sitio — Next.js 16 (build de producción)
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Las variables NEXT_PUBLIC_* se incrustan en el bundle en tiempo de build,
# así que se pasan como build args (URLs tal como las ve el NAVEGADOR).
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "start:3001"]
