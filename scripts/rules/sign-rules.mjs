#!/usr/bin/env node
// Ed25519 signing for Brainling detection rulesets. See docs/modules/M01-detection.md.
//
//   node scripts/rules/sign-rules.mjs keygen <keyId>
//   node scripts/rules/sign-rules.mjs sign <keyId> <rules.json> <out.signed.json>
//   node scripts/rules/sign-rules.mjs verify <publicKeyBase64> <keyId> <file.signed.json>
//
// Private keys live in .secrets/rules-signing/<keyId>.pem (git-ignored) and must never be
// committed or copied into CI. The production key stays offline. Set BRAINLING_RULES_KEY_DIR to
// read keys from another directory (e.g. the main checkout when signing from a git worktree).
import { Buffer } from 'node:buffer';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEY_DIR = path.resolve(process.env.BRAINLING_RULES_KEY_DIR ?? '.secrets/rules-signing');
const KEY_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function out(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`sign-rules: ${message}\n`);
  process.exit(1);
}

function keyPath(keyId) {
  if (!KEY_ID.test(keyId ?? '')) fail('keyId must match ' + KEY_ID);
  return path.join(KEY_DIR, `${keyId}.pem`);
}

function rawPublicKey(publicKey) {
  return Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
}

function publicKeyFromRaw(rawBase64) {
  const x = Buffer.from(rawBase64, 'base64');
  if (x.length !== 32) fail('public key must be 32 bytes');
  return createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: x.toString('base64url') },
    format: 'jwk',
  });
}

/** Light structural checks; the app re-validates everything after verifying the signature. */
function checkRules(rules) {
  if (rules.schema !== 2) fail('schema must be 2');
  if (!Number.isInteger(rules.version) || rules.version < 1)
    fail('version must be a positive integer');
  if (!ISO.test(rules.issuedAt) || !ISO.test(rules.expiresAt))
    fail('issuedAt/expiresAt must be UTC ISO');
  if (Date.parse(rules.expiresAt) <= Date.now()) fail('expiresAt is in the past');
  for (const app of rules.apps ?? []) {
    const hasSignal =
      app.surfaceIds?.length > 0 || app.contentDescriptions?.length > 0 || app.structure != null;
    if (!(app.packageNames?.length > 0)) fail(`${app.key}: packageNames missing`);
    if (app.enabled && !hasSignal) fail(`${app.key}: enabled without a detection signal`);
  }
}

function keygen(keyId) {
  const file = keyPath(keyId);
  if (existsSync(file)) fail(`${file} already exists; refusing to overwrite`);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(file, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  out(`private key: ${file} (git-ignored, never commit)`);
  out(`public key for TrustedRuleKeys.kt: "${keyId}" to "${rawPublicKey(publicKey)}"`);
}

function signRules(keyId, input, output) {
  const privateKey = createPrivateKey(readFileSync(keyPath(keyId)));
  const rules = JSON.parse(readFileSync(input, 'utf8'));
  checkRules(rules);
  const payload = Buffer.from(JSON.stringify(rules), 'utf8');
  const signature = sign(null, payload, privateKey);
  if (!verify(null, payload, createPublicKey(privateKey), signature)) fail('self-check failed');
  const envelope = {
    alg: 'Ed25519',
    keyId,
    payload: payload.toString('base64'),
    signature: signature.toString('base64'),
  };
  writeFileSync(output, JSON.stringify(envelope, null, 2) + '\n');
  out(`signed v${rules.version} with ${keyId} -> ${output}`);
}

function verifyFile(publicKeyBase64, keyId, file) {
  const envelope = JSON.parse(readFileSync(file, 'utf8'));
  if (envelope.alg !== 'Ed25519' || envelope.keyId !== keyId) fail('alg/keyId mismatch');
  const payload = Buffer.from(envelope.payload, 'base64');
  const ok = verify(
    null,
    payload,
    publicKeyFromRaw(publicKeyBase64),
    Buffer.from(envelope.signature, 'base64'),
  );
  if (!ok) fail('signature does not verify');
  out(`ok: v${JSON.parse(payload.toString('utf8')).version}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'keygen' && args.length === 1) keygen(args[0]);
else if (command === 'sign' && args.length === 3) signRules(...args);
else if (command === 'verify' && args.length === 3) verifyFile(...args);
else fail('usage: keygen <keyId> | sign <keyId> <in> <out> | verify <publicKeyB64> <keyId> <file>');
