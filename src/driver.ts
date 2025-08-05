import {
  createSASLInitialResponse,
  createSASLResponse,
  parseSASLContinueMessage,
} from "./auth-sasl.js";
import {
  AuthenticationSASLMechanism,
  parseAuthenticationMessage,
  ServerAuthenticationMessageType,
} from "./auth.js";
import { createStartupMessage } from "./message.js";
import net from "node:net";

let clientNonce: string | null = null;
let clientFirstMessageBare: Buffer | null = null;

const client = net.createConnection({ port: 5432 }, () => {
  const startupMessage = createStartupMessage({
    user: "postgres",
    database: "test",
  });
  client.write(startupMessage);
});

client.on("data", (data) => {
  console.log("Received data from server:", data.toString());

  const authenticationMessage = parseAuthenticationMessage(data);
  switch (authenticationMessage.type) {
    case ServerAuthenticationMessageType.AuthenticationSASL:
      {
        console.log(
          "Authentication message received:",
          authenticationMessage.mechanisms
        );

        const { payload, nonce, base } = createSASLInitialResponse(
          "postgres",
          AuthenticationSASLMechanism.SCRAM_SHA_256
        );
        clientNonce = nonce;
        clientFirstMessageBare = Buffer.from(base, "utf8");
        client.write(payload);
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      {
        if (!clientNonce) {
          throw new Error("Client nonce is not set for SASL continue message");
        }

        const payload = parseSASLContinueMessage(
          authenticationMessage.scramPayload,
          clientNonce
        );

        if (!clientFirstMessageBare) {
          throw new Error(
            "Client first message bare is not set for SASL continue"
          );
        }

        clientNonce = null;
        const response = createSASLResponse(
          payload,
          "password", // Replace with actual password
          clientFirstMessageBare,
          authenticationMessage.scramPayload
        );
        client.write(response);
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      {
        console.log(
          "SASL authentication final message received",
          authenticationMessage.scramPayload.toString("utf-8")
        );
        // Handle final SASL message if needed
      }
      break;
  }
});

client.on("end", () => {
  console.log("disconnected from server");
});
