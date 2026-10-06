FROM node:20-bookworm

WORKDIR /app

# Install ffmpeg and python3 (required for yt-dlp)
RUN apt-get update && apt-get install -y ffmpeg python3 curl

# Download yt-dlp Linux binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /app/yt-dlp \
    && chmod a+rx /app/yt-dlp

COPY package*.json ./
RUN npm install

COPY . .

# Create videos directory in the parent folder as expected by server.js
RUN mkdir -p /vídeos

EXPOSE 3000

CMD ["node", "server.js"]
