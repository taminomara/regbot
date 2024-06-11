# syntax=docker/dockerfile:1

FROM node:22
COPY . /app
WORKDIR /app
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DATABASE=/prod_data/db/prod.db
ENV REGBOT_ENV_FILE_PATH=/prod_data/config.env
RUN npm ci --omit=dev
EXPOSE 8080
CMD npm run start:prod
