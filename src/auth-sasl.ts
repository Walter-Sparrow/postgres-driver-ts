import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { AuthenticationSASLMechanism } from "./auth.js";

interface SCRAMInitialResponse {
  payload: Buffer;
  nonce: string;
  base: string;
}

function createSCRAMInitialResponse(username: string): SCRAMInitialResponse {
  const nonce = new Uint8Array(18);
  crypto.getRandomValues(nonce);

  const nonceString = Buffer.from(nonce).toString("base64");
  const base = `n=${username},r=${nonceString}`;
  const response = `n,,${base}`;
  return {
    payload: Buffer.from(response, "utf8"),
    nonce: nonceString,
    base,
  };
}

interface SASLInitialResponse {
  payload: Buffer;
  nonce: string;
  base: string;
}

export function createSASLInitialResponse(
  username: string,
  mechanism: AuthenticationSASLMechanism
): SASLInitialResponse {
  const {
    payload: initialResponse,
    nonce,
    base,
  } = createSCRAMInitialResponse(username);

  //           = 4 (length field) + mechanism bytes + 1 (null) + 4 (initialResponse length) + initialResponse bytes
  const length =
    4 + Buffer.byteLength(mechanism, "utf8") + 1 + 4 + initialResponse.length;

  const buffer = Buffer.alloc(1 + length);
  let offset = 0;

  buffer.write("p", offset, 1, "utf8");
  offset += 1;

  buffer.writeUInt32BE(length, offset);
  offset += 4;

  buffer.write(mechanism, offset, "utf8");
  offset += Buffer.byteLength(mechanism, "utf8");

  buffer.writeUInt8(0, offset);
  offset += 1;

  buffer.writeUInt32BE(initialResponse.length, offset);
  offset += 4;

  initialResponse.copy(buffer, offset);
  offset += initialResponse.length;

  return { payload: buffer, nonce, base };
}

interface AuthenticationSASLContinuePayload {
  nonce: string;
  salt: string;
  iterations: number;
}

export function parseSASLContinueMessage(
  data: Buffer,
  clientNonce: string
): AuthenticationSASLContinuePayload {
  const scramString = data.toString("utf8");
  const parts = scramString.split(",");
  const noncePart = parts.find((part) => part.startsWith("r="));
  if (!noncePart || !noncePart.startsWith("r=" + clientNonce)) {
    throw new Error(
      "Invalid SCRAM nonce or client nonce mismatch, expected: " + clientNonce
    );
  }

  const saltPart = parts.find((part) => part.startsWith("s="));
  const iterationsPart = parts.find((part) => part.startsWith("i="));
  return {
    nonce: noncePart!.slice(2),
    salt: saltPart!.slice(2),
    iterations: parseInt(iterationsPart!.slice(2)),
  };
}

interface SASLResponse {
  payload: Buffer;
  signature: Buffer;
}

const comma = Buffer.from(",");
export function createSASLResponse(
  serverResponse: AuthenticationSASLContinuePayload,
  password: string,
  clientFirstMessageBare: Buffer,
  serverFirstMessage: Buffer
): SASLResponse {
  const { nonce, salt: saltBase64, iterations } = serverResponse;
  const salt = Buffer.from(saltBase64, "base64");

  const channelBinding = "biws";
  const finalWithoutProof = `c=${channelBinding},r=${nonce}`;

  const saltedPassword = pbkdf2Sync(password, salt, iterations, 32, "sha256");

  const clientKey = createHmac("sha256", saltedPassword)
    .update("Client Key")
    .digest();

  const storedKey = createHash("sha256").update(clientKey).digest();

  const authMessage = Buffer.concat([
    clientFirstMessageBare,
    comma,
    serverFirstMessage,
    comma,
    Buffer.from(finalWithoutProof, "utf8"),
  ]);

  const clientSignature = createHmac("sha256", storedKey)
    .update(authMessage)
    .digest();

  const clientProof = Buffer.alloc(clientKey.length);
  for (let i = 0; i < clientKey.length; i++) {
    clientProof[i] = clientKey[i] ^ clientSignature[i];
  }

  const clientProofBase64 = clientProof.toString("base64");

  const finalMessage = `c=${channelBinding},r=${nonce},p=${clientProofBase64}`;
  const finalMessageBuffer = Buffer.from(finalMessage, "utf8");

  const totalLength = 4 + finalMessageBuffer.length;
  const buffer = Buffer.alloc(1 + totalLength);

  let offset = 0;
  buffer.writeUInt8("p".charCodeAt(0), offset);
  offset += 1;

  buffer.writeUInt32BE(totalLength, offset);
  offset += 4;

  finalMessageBuffer.copy(buffer, offset);

  const serverKey = createHmac("sha256", saltedPassword)
    .update("Server Key")
    .digest();
  const serverSignature = createHmac("sha256", serverKey)
    .update(authMessage)
    .digest("base64");

  return {
    payload: buffer,
    signature: Buffer.from(serverSignature),
  };
}

export function parseSASLFinalMessage(data: Buffer): Buffer {
  const offset = data.indexOf("v=") + 2;
  const end = data.lastIndexOf("=") + 1;
  return data.subarray(offset, end);
}
