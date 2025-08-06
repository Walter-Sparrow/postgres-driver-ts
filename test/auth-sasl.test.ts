import { it, describe } from "node:test";
import {
  parseSASLContinueMessage,
  parseSASLFinalMessage,
} from "../src/auth-sasl.js";
import assert from "assert";

describe("parseSASLContinueMessage", () => {
  it("should parse the payload correctly", () => {
    const serverNonce = "serverNonce";
    const clientNonce = "clientNonce";
    const payload = Buffer.from(
      `r=${clientNonce.concat(serverNonce)},s=salt,i=10000`,
      "utf8"
    );

    const result = parseSASLContinueMessage(payload, clientNonce);

    assert.equal(
      result.nonce,
      clientNonce.concat(serverNonce),
      "Nonce should match the input"
    );
    assert.equal(result.salt, "salt", "Salt should be parsed correctly");
    assert.equal(
      result.iterations,
      10000,
      "Iterations should be parsed correctly"
    );
  });

  it("should throw an error for invalid nonce", () => {
    const serverNonce = "serverNonce";
    const clientNonce = "invalidClientNonce";
    const payload = Buffer.from(
      `r=${clientNonce.concat(serverNonce)},s=salt,i=10000`,
      "utf8"
    );

    assert.throws(
      () => parseSASLContinueMessage(payload, "expectedClientNonce"),
      {
        message:
          "Invalid SCRAM nonce or client nonce mismatch, expected: expectedClientNonce",
      }
    );
  });
});

describe("parseSASLFinalMessage", () => {
  it("should parse the payload correctly", () => {
    const payload = Buffer.from("v=signature=\0", "utf8");
    const result = parseSASLFinalMessage(payload, payload.length);
    assert.equal(result.toString("utf8"), "signature=");
  });
});
