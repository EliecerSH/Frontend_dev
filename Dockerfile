# Etapa 1: Build
FROM public.ecr.aws/docker/library/node:18-alpine AS build
WORKDIR /app

# 1. Definir los argumentos pasados por GitHub Actions
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID
ARG VITE_AZURE_SCOPE
ARG VITE_MS_USUARIOS_URL
ARG VITE_MS_PRODUCTOS_URL
ARG VITE_MS_CARRITO_URL
ARG VITE_MS_ORDENES_URL

# 2. Convertirlos a variables de entorno para que Vite los inyecte en el bundle
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_AZURE_SCOPE=$VITE_AZURE_SCOPE
ENV VITE_MS_USUARIOS_URL=$VITE_MS_USUARIOS_URL
ENV VITE_MS_PRODUCTOS_URL=$VITE_MS_PRODUCTOS_URL
ENV VITE_MS_CARRITO_URL=$VITE_MS_CARRITO_URL
ENV VITE_MS_ORDENES_URL=$VITE_MS_ORDENES_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: Servidor Web Nginx
FROM public.ecr.aws/docker/library/nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]