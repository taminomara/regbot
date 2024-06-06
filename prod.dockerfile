# syntax=docker/dockerfile:1

FROM node:22
COPY . /app
WORKDIR /app
RUN npm ci --include prod
EXPOSE 8080
CMD npm run start:prod
