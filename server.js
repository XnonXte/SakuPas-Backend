import "dotenv/config";
import app from "./src/app.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`SakuPas API listening on port ${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
