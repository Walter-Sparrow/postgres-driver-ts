import { MessageType } from "./message.js";

export enum ServerAuthenticationMessageType {
  AuthenticationOk = 0,
  AuthenticationKerberosV5 = 2,
  AuthenticationCleartextPassword = 3,
  AuthenticationMD5Password = 5,
  AuthenticationGSS = 7,
  AuthenticationGSSContinue = 8,
  AuthenticationSASL = 10,
  AuthenticationSASLContinue = 11,
  AuthenticationSASLFinal = 12,
}

export enum AuthenticationSASLMechanism {
  SCRAM_SHA_256 = "SCRAM-SHA-256",
  SCRAM_SHA_256_PLUS = "SCRAM-SHA-256-PLUS",
}

function toAuthenticationSASLMechanism(
  mechanism: string
): AuthenticationSASLMechanism | null {
  if (
    Object.values(AuthenticationSASLMechanism).includes(
      mechanism as AuthenticationSASLMechanism
    )
  ) {
    return mechanism as AuthenticationSASLMechanism;
  }
  return null;
}

export interface AuthenticationOk {
  type: ServerAuthenticationMessageType.AuthenticationOk;
}

export interface AuthenticationSASL {
  type: ServerAuthenticationMessageType.AuthenticationSASL;
  mechanisms: AuthenticationSASLMechanism[];
}

export interface AuthenticationSASLContinue {
  type: ServerAuthenticationMessageType.AuthenticationSASLContinue;
  scramPayload: Buffer;
}

export interface AuthenticationSASLFinal {
  type: ServerAuthenticationMessageType.AuthenticationSASLFinal;
  scramPayload: Buffer;
}

export type ServerAuthenticationMessage =
  | AuthenticationOk
  | AuthenticationSASL
  | AuthenticationSASLContinue
  | AuthenticationSASLFinal;

export function parseAuthenticationMessage(
  data: Buffer
): ServerAuthenticationMessage {
  let offset = 0;
  const messageType = data.readUInt8(offset);
  offset += 1;
  if (messageType !== MessageType.Authentication) {
    throw new Error(`Expected Authentication message, got type ${messageType}`);
  }

  data.readUInt32BE(offset); // Read the length of the message
  offset += 4;

  const type = data.readUInt32BE(offset);
  offset += 4;

  switch (type) {
    case ServerAuthenticationMessageType.AuthenticationOk:
      return { type: ServerAuthenticationMessageType.AuthenticationOk };
    case ServerAuthenticationMessageType.AuthenticationSASL:
      const mechanisms = data
        .toString("utf8", offset)
        .split("\0")
        .map((m) => m.trim())
        .map(toAuthenticationSASLMechanism)
        .filter(Boolean) as AuthenticationSASLMechanism[];
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASL,
        mechanisms,
      };
    case ServerAuthenticationMessageType.AuthenticationSASLContinue:
      const scramPayload = data.subarray(offset);
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASLContinue,
        scramPayload,
      };
    case ServerAuthenticationMessageType.AuthenticationSASLFinal:
      const finalPayload = data.subarray(offset);
      return {
        type: ServerAuthenticationMessageType.AuthenticationSASLFinal,
        scramPayload: finalPayload,
      };
    default:
      throw new Error(`Unknown authentication message type: ${type}`);
  }
}
