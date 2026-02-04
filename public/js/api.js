// 🔒 FORCE NGROK — NO LOCALHOST
if (
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
) {
  location.replace("https://querulous-interresponsible-carleen.ngrok-free.dev");
}

window.API_BASE = "https://querulous-interresponsible-carleen.ngrok-free.dev";
console.log("🌐 API BASE:", window.API_BASE);
