/**
 * Custom error class for timeout errors.
 */
export class TimeoutError extends Error {}

/**
 * Wrap a promise with a timeout.
 */
export function withTimeout(promise, timeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new TimeoutError()), timeout)),
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
