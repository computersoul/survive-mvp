FROM python:3.11-slim

RUN apt-get update && apt-get install -y nodejs npm

WORKDIR /app

COPY package.json . 

COPY web/frontend/package.json ./web/frontend/ 

COPY web/backend/package.json ./web/backend/ 

COPY bot/requirements.txt ./bot/

RUN npm install 

RUN cd web/frontend && npm install 

RUN cd web/backend && npm install 

RUN cd bot && pip install -r requirements.txt