import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenValido } from "./avisos.ts";

test("solo pasa lo que parece un identificador de aparato", () => {
  assert.equal(tokenValido("ExponentPushToken[abc123]"), "ExponentPushToken[abc123]");
  assert.equal(tokenValido("  ExpoPushToken[xyz]  "), "ExpoPushToken[xyz]");
  assert.equal(tokenValido("cualquier cosa"), null);
  assert.equal(tokenValido(""), null);
  assert.equal(tokenValido(null), null);
  assert.equal(tokenValido("ExponentPushToken[]"), null);
});
