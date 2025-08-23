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
 * Convert a byte array to a hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
