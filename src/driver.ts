import { createStartupMessage, handlePgMessages } from "./message.js";
import net from "node:net";

const user = process.env.USER || "postgres";

const client = net.createConnection({ port: 5432, noDelay: true }, () => {
  const startupMessage = createStartupMessage({
    user,
    database: process.env.DATABASE || "postgres",
  });
  client.write(startupMessage);
});

client.on("data", (data) => {
  console.log("Received data from server:", data.toString("utf8"));
  handlePgMessages(data, client);
});

client.on("end", () => {
  console.log("disconnected from server");
});
