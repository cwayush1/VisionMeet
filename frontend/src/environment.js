let IS_PROD = true;

const server = IS_PROD
    ? "https://visionmeetbackend-me53.onrender.com"
    : "http://localhost:8000";

export default server;