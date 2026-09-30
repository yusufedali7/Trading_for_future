import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Incremental SHA-256 over UTF-8 text. Pure JS, so Node and browsers produce identical digests. */
export function createTextHasher() {
  const h = sha256.create();
  return {
    update(text: string) {
      h.update(utf8ToBytes(text));
      return this;
    },
    hex(): string {
      return bytesToHex(h.digest());
    },
  };
}
