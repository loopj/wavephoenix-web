/**
 * Wrap a promise with a timeout.
 */
export function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => {
        const error = new Error('Connection timed out');
        error.name = 'TimeoutError';
        error.code = 'ETIMEDOUT';
        reject(error);
      }, timeout),
    ),
  ]);
}

/**
 * Parse uint32 into semantic version object.
 * Layout: [major, minor, patch, build] = bytes (MSB→LSB).
 * @param {number} n - 32-bit unsigned integer
 * @returns {{major:number, minor:number, patch:number, build:number}}
 */
export function uint32ToSemver(version) {
  return {
    major: (version >> 24) & 0xff,
    minor: (version >> 16) & 0xff,
    patch: (version >> 8) & 0xff,
    build: version & 0xff,
  };
}

/**
 * Convert semantic version object into string.
 * @param {{major:number, minor:number, patch:number, build?:number}} version
 * @returns {string}
 */
export function semverToString(version) {
  if (!version) return '(unknown)';

  let versionString = `${version.major}.${version.minor}.${version.patch}`;
  if (version.build !== 0) versionString += `+${version.build}`;

  return versionString;
}

/**
 * Convert a 16-byte array to a UUID string.
 * @param {Uint8Array} bytes - 16-byte array
 * @returns {string} - UUID string, in 8-4-4-4-12 format
 */
export function bytesToUUIDString(bytes) {
  if (bytes.length !== 16) throw new Error('Invalid byte length');

  // Convert to hex string
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  // Insert UUID dashes (8-4-4-4-12)
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/**
 * Check if two typed arrays are equal.
 * @param {TypedArray} a
 * @param {TypedArray} b
 * @return {boolean}
 */
export function typedArraysEqual(a, b) {
  return a?.byteLength === b?.byteLength && a?.every((v, i) => v === b[i]);
}
