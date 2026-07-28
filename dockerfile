FROM node:24-bookworm

WORKDIR /opt/render/project/src

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm ci
RUN npm --prefix frontend ci
RUN npm --prefix backend ci

COPY . .

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r backend/ml/requirements.txt

RUN npm --prefix frontend run build

ENV PYTHON_BIN=python3
ENV NODE_ENV=production

CMD ["npm", "--prefix", "backend", "start"]