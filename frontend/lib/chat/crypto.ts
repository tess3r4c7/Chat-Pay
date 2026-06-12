import nacl from 'tweetnacl'
import axios from 'axios'
import util from 'tweetnacl-util'

/**
 * Generate or load an existing NaCl keypair from localStorage.
 * Always re-registers the public key with the chat server (idempotent).
 */
export async function getOrCreateKeyPair(apiBase: string, token: string) {
  let stored = localStorage.getItem('chatKeyPair')

  if (!stored) {
    const keyPair = nacl.box.keyPair()
    stored = JSON.stringify({
      publicKey: util.encodeBase64(keyPair.publicKey),
      privateKey: util.encodeBase64(keyPair.secretKey),
    })
    localStorage.setItem('chatKeyPair', stored)
  }

  const storedKeyPair = JSON.parse(stored)

  // Always (re)register the public key with the chat server — idempotent,
  // so it self-heals if a previous registration failed.
  try {
    await axios.post(
      `${apiBase}/api/users/publickey`,
      { publicKey: storedKeyPair.publicKey },
      { headers: { Authorization: `Bearer ${token}` } }
    )
  } catch (e) {
    console.error('Failed to register public key', e)
  }

  return {
    publicKey: util.decodeBase64(storedKeyPair.publicKey),
    privateKey: util.decodeBase64(storedKeyPair.privateKey),
  }
}

/**
 * Encrypt a plaintext message using NaCl box (authenticated encryption).
 * Returns base64-encoded cipherText and nonce.
 */
export function encryptMessage(
  message: string,
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const messageUInt8 = util.decodeUTF8(message)
  const cipherText = nacl.box(messageUInt8, nonce, theirPublicKey, myPrivateKey)
  return {
    cipherText: util.encodeBase64(cipherText),
    nonce: util.encodeBase64(nonce),
  }
}

/**
 * Decrypt a ciphertext using NaCl box.open.
 * Returns plaintext string, or null if decryption fails.
 */
export function decryptMessage(
  cipherTextB64: string,
  nonceB64: string,
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): string | null {
  const ct = util.decodeBase64(cipherTextB64)
  const n = util.decodeBase64(nonceB64)
  const plain = nacl.box.open(ct, n, theirPublicKey, myPrivateKey)
  return plain ? util.encodeUTF8(plain) : null
}
