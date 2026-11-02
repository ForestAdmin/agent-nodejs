import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface EncryptedBlob {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface TokenCipher {
  encrypt(plaintext: string): EncryptedBlob;
  decrypt(blob: EncryptedBlob): string;
}

function bytes(value: string | Uint8Array): Uint8Array {
  return new Uint8Array(typeof value === 'string' ? Buffer.from(value, 'base64') : value);
}

function toBase64(value: Uint8Array): string {
  return Buffer.from(value).toString('base64');
}

export default function createTokenCipher(base64Key: string): TokenCipher {
  const key = bytes(base64Key);

  return {
    encrypt(plaintext) {
      const iv = new Uint8Array(crypto.randomBytes(IV_BYTES));
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      const ciphertext = new Uint8Array(
        Buffer.concat([
          new Uint8Array(cipher.update(plaintext, 'utf8')),
          new Uint8Array(cipher.final()),
        ]),
      );

      return {
        iv: toBase64(iv),
        authTag: toBase64(new Uint8Array(cipher.getAuthTag())),
        ciphertext: toBase64(ciphertext),
      };
    },
    decrypt({ iv, authTag, ciphertext }) {
      const ivBytes = bytes(iv);
      const tagBytes = bytes(authTag);

      if (ivBytes.length !== IV_BYTES || tagBytes.length !== AUTH_TAG_BYTES) {
        throw new Error('Malformed encrypted blob');
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBytes, {
        authTagLength: AUTH_TAG_BYTES,
      });
      decipher.setAuthTag(tagBytes);

      return Buffer.concat([
        new Uint8Array(decipher.update(bytes(ciphertext))),
        new Uint8Array(decipher.final()),
      ]).toString('utf8');
    },
  };
}
