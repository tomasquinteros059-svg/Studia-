import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  construirReclamos, firmarToken, leerReclamos, nombreDeSala, VIGENCIA_SEGUNDOS,
} from "./sala-nucleo.ts";

const AHORA = 1_800_000_000;
const ESTUDIANTE = {
  sala: "clase-abc", identidad: "u-1", nombre: "Eduardo Q.", papel: "estudiante" as const,
};
const DOCENTE = { ...ESTUDIANTE, identidad: "d-1", nombre: "Ana Ríos", papel: "docente" as const };

test("la sala se deriva de la clase, no de lo que mande el cliente", () => {
  assert.equal(nombreDeSala("abc"), "clase-abc");
  assert.notEqual(nombreDeSala("abc"), nombreDeSala("abd"));
});

test("el estudiante entra escuchando, sin poder publicar", () => {
  const r = construirReclamos(ESTUDIANTE, "API", AHORA);
  assert.equal(r.video.canPublish, false);
  assert.equal(r.video.canSubscribe, true);
  assert.equal(r.video.roomJoin, true);
  assert.equal(r.video.roomAdmin, false);
});

test("el docente publica y administra la sala", () => {
  const r = construirReclamos(DOCENTE, "API", AHORA);
  assert.equal(r.video.canPublish, true);
  assert.equal(r.video.roomAdmin, true);
});

test("dar la palabra requiere un token nuevo, no un permiso que ya se tenía", () => {
  const callado = construirReclamos(ESTUDIANTE, "API", AHORA);
  const conPalabra = construirReclamos(ESTUDIANTE, "API", AHORA, true);
  assert.equal(callado.video.canPublish, false);
  assert.equal(conPalabra.video.canPublish, true);
  // Ni siquiera con la palabra dada administra la sala.
  assert.equal(conPalabra.video.roomAdmin, false);
});

test("el token vence y no vale antes de tiempo", () => {
  const r = construirReclamos(ESTUDIANTE, "API", AHORA);
  assert.equal(r.nbf, AHORA);
  assert.equal(r.exp, AHORA + VIGENCIA_SEGUNDOS);
  assert.ok(r.exp > r.nbf);
});

test("la identidad y el nombre viajan en el token", () => {
  const r = construirReclamos(ESTUDIANTE, "API", AHORA);
  assert.equal(r.sub, "u-1");
  assert.equal(r.name, "Eduardo Q.");
  assert.equal(r.iss, "API");
});

test("el token firmado tiene las tres partes de un JWT", async () => {
  const token = await firmarToken(construirReclamos(ESTUDIANTE, "API", AHORA), "secreto");
  assert.equal(token.split(".").length, 3);
  for (const parte of token.split(".")) assert.ok(parte.length > 0);
});

test("la cabecera declara HS256, que es lo que LiveKit espera", async () => {
  const token = await firmarToken(construirReclamos(ESTUDIANTE, "API", AHORA), "secreto");
  const cabecera = JSON.parse(
    Buffer.from(token.split(".")[0]!, "base64url").toString("utf8"));
  assert.deepEqual(cabecera, { alg: "HS256", typ: "JWT" });
});

test("la firma es la que produciría cualquier verificador de JWT", async () => {
  const reclamos = construirReclamos(ESTUDIANTE, "API", AHORA);
  const token = await firmarToken(reclamos, "secreto");
  const [cabecera, cuerpo, firma] = token.split(".");

  const esperada = createHmac("sha256", "secreto")
    .update(`${cabecera}.${cuerpo}`)
    .digest("base64url");

  assert.equal(firma, esperada);
});

test("un secreto distinto produce otra firma", async () => {
  const reclamos = construirReclamos(ESTUDIANTE, "API", AHORA);
  const a = await firmarToken(reclamos, "secreto");
  const b = await firmarToken(reclamos, "otro-secreto");
  assert.notEqual(a.split(".")[2], b.split(".")[2]);
});

test("el token se puede volver a leer tal cual se armó", async () => {
  const reclamos = construirReclamos(DOCENTE, "API", AHORA);
  const token = await firmarToken(reclamos, "secreto");
  assert.deepEqual(leerReclamos(token), reclamos);
});

test("los acentos del nombre sobreviven al ida y vuelta", async () => {
  const conAcentos = { ...ESTUDIANTE, nombre: "José Muñoz Ñuñoa" };
  const token = await firmarToken(construirReclamos(conAcentos, "API", AHORA), "s");
  assert.equal(leerReclamos(token).name, "José Muñoz Ñuñoa");
});

test("el base64 del token es seguro para URL", async () => {
  const token = await firmarToken(construirReclamos(ESTUDIANTE, "API", AHORA), "secreto");
  assert.doesNotMatch(token, /[+/=]/, "no debería llevar +, / ni relleno");
});
