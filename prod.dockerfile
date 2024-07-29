# syntax=docker/dockerfile:1

FROM node:22

COPY . /app
WORKDIR /app

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FILE=/prod_data/logs/regbot.log
ENV PID_FILE=/var/run/regbot.pid
ENV DATABASE=/prod_data/db/prod.db
ENV REGBOT_ENV_FILE_PATH=/prod_data/config.env
ENV BACKGROUND_TASK_FREQUENCY_MS=900000

RUN apt-get update && apt-get install -y logrotate
RUN cat >/etc/logrotate.d/regbot <<EOF
    /prod_data/logs/*log {
        rotate 10
        daily
        size 20M
        missingok
        notifempty
        postrotate
           kill -HUP \$(cat /var/run/regbot.pid)
       endscript
    }
EOF

RUN npm ci --omit=dev

EXPOSE 8080

CMD npm run start:prod
