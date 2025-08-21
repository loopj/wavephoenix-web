const MCUBOOT_IMAGE_MAGIC = 0x96f3b83d;

/**
 * MCUboot image format
 * See https://docs.mcuboot.com/design.html
 */
export class MCUbootImage {
  constructor(arrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
    this.dataView = new DataView(arrayBuffer);
  }

  getMagicNumber() {
    return this.dataView.getUint32(0, true);
  }

  isValid() {
    return this.getMagicNumber() === MCUBOOT_IMAGE_MAGIC;
  }

  getVersion() {
    return {
      major: this.dataView.getUint8(20),
      minor: this.dataView.getUint8(21),
      patch: this.dataView.getUint16(22, true),
      build: this.dataView.getUint32(24, true),
    };
  }

  getSize() {
    return this.data.length;
  }

  async calculateSHA256() {
    return await crypto.subtle.digest("SHA-256", this.data);
  }
}
