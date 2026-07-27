FROM node:24-bookworm

WORKDIR /opt/render/project/src

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm ci
RUN npm --prefix frontend ci
RUN npm --prefix backend ci

COPY . .

RUN pip3 install --no-cache-dir -r backend/ml/requirements.txt
RUN npm --prefix frontend run build

ENV PYTHON_BIN=python3
ENV NODE_ENV=production

CMD ["npm", "--prefix", "backend", "start"]

