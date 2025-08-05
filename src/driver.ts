import {
  createSASLInitialResponse,
  createSASLResponse,
  parseSASLContinueMessage,
  parseSASLFinalMessage,
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
let serverSignature: Buffer | null = null;

const client = net.createConnection({ port: 5432 }, () => {
  const startupMessage = createStartupMessage({
    user: process.env.USER || "postgres",
    database: process.env.DATABASE || "postgres",
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
          process.env.PASS || "",
          clientFirstMessageBare,
          authenticationMessage.scramPayload
        );
        serverSignature = response.signature;
        client.write(response.payload);
      }
      break;
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      {
        if (!serverSignature) {
          throw new Error("Server signature is not set for SASL final message");
        }

        const payload = parseSASLFinalMessage(
          authenticationMessage.scramPayload
        );

        if (!payload.equals(serverSignature)) {
          throw new Error(
            "Server signature does not match expected signature, expected: " +
              serverSignature.toString("utf8") +
              ", got: " +
              payload.toString("utf8")
          );
        }

        serverSignature = null;
      }
      break;
  }
});

client.on("end", () => {
  console.log("disconnected from server");
});
