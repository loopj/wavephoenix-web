/**
 * Wrap a promise with a timeout.
 */
export function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => {
        const error = new Error("Connection timed out");
        error.name = "TimeoutError";
        error.code = "ETIMEDOUT";
        reject(error);
      }, timeout),
    ),
  ]);
}

/**
 * Convert a semantic version object to a string.
 */
export function versionString(version) {
  if (!version) return "(unknown)";

  let versionString = `${version.major}.${version.minor}.${version.patch}`;
  if (version.build !== 0) {
    versionString += `+${version.build}`;
  }
  return versionString;
}

/**
 * Convert a byte array to a hex string.
 */
export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
