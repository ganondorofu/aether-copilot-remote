// ── E2E Encryption using tweetnacl (NaCl SecretBox) ──
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
const { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } = naclUtil;

// Generate a new secret key (32 bytes)
export function generateKey() {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

// Export key as base64 for sharing
export function exportKey(key) {
  return encodeBase64(key);
}

// Import key from base64
export function importKey(b64) {
  return decodeBase64(b64);
}

// Encrypt a message (JSON-serializable object) with the shared secret
export function encrypt(message, key) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = decodeUTF8(JSON.stringify(message));
  const box = nacl.secretbox(messageUint8, nonce, key);
  // Return nonce + ciphertext as base64
  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(box),
  };
}

// Decrypt a message
export function decrypt(encrypted, key) {
  const nonce = decodeBase64(encrypted.nonce);
  const ciphertext = decodeBase64(encrypted.ciphertext);
  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
  if (!decrypted) throw new Error("Decryption failed – wrong key or tampered data");
  return JSON.parse(encodeUTF8(decrypted));
}
