/**
 * MCUboot image format
 * See https://docs.mcuboot.com/design.html
 */

const MCUBOOT_IMAGE_MAGIC = 0x96f3b83d;

const IMAGE_TLV_INFO_MAGIC = 0x6907;
const IMAGE_TLV_PROT_INFO_MAGIC = 0x6908;

// Image header flags.
export const HEADER_FLAG = {
  PIC: 1 << 0,
  ENCRYPTED_AES128: 1 << 2,
  ENCRYPTED_AES256: 1 << 3,
  NON_BOOTABLE: 1 << 4,
  RAM_LOAD: 1 << 5,
};

// Image trailer TLV types.
export const TLV_TYPE = {
  KEYHASH: 0x01,
  SHA256: 0x10,
  RSA2048_PSS: 0x20,
  ECDSA224: 0x21,
  ECDSA_SIG: 0x22,
  RSA3072_PSS: 0x23,
  ED25519: 0x24,
  SIG_PURE: 0x25,
  ENC_RSA2048: 0x30,
  ENC_KW: 0x31,
  ENC_EC256: 0x32,
  ENC_X25519: 0x33,
  DEPENDENCY: 0x40,
  SEC_CNT: 0x50,
};

export class MCUbootImage {
  #buffer;
  #dataView;

  header = null;
  payload = null;
  protectedTLVs = {};
  TLVs = {};

  constructor(buffer, parse = true) {
    this.#buffer = new Uint8Array(buffer);
    this.#dataView = new DataView(buffer);

    if (parse) this.parse();
  }

  parse() {
    this.header = this.#parseHeader();
    this.payload = this.#parsePayload();

    let offset = this.header.hdr_size + this.header.img_size;

    // Parse protected TLVs (if any)
    if (this.header.protect_tlv_size !== 0) {
      offset = this.#parseTLVs(offset, this.protectedTLVs, IMAGE_TLV_PROT_INFO_MAGIC);
    }

    // Parse TLVs
    offset = this.#parseTLVs(offset, this.TLVs, IMAGE_TLV_INFO_MAGIC);
  }

  async isValid() {
    // 32-bit magic number must be correct
    if (this.header.magic !== MCUBOOT_IMAGE_MAGIC) return false;

    // Calculated SHA256 must match SHA256 TLV contents.
    if ((await this.#validateSHA256()) === false) return false;

    // Image may contain a signature TLV. If it does, it must also have a
    // KEYHASH TLV with the hash of the key that was used to sign. The list of
    // keys will then be iterated over looking for the matching key, which then
    // will then be used to verify the image contents.
    // TODO

    return true;
  }

  getVersion() {
    return this.header.version;
  }

  getTLV(id) {
    return this.TLVs[id] || this.protectedTLVs[id];
  }

  #parseHeader() {
    return {
      magic: this.#dataView.getUint32(0, true),
      load_addr: this.#dataView.getUint32(4, true),
      hdr_size: this.#dataView.getUint16(8, true),
      protect_tlv_size: this.#dataView.getUint16(10, true),
      img_size: this.#dataView.getUint32(12, true),
      flags: this.#dataView.getUint32(16, true),
      version: {
        major: this.#dataView.getUint8(20),
        minor: this.#dataView.getUint8(21),
        patch: this.#dataView.getUint16(22, true),
        build: this.#dataView.getUint32(24, true),
      },
    };
  }

  #parsePayload() {
    return new Uint8Array(this.#buffer.buffer, this.header.hdr_size, this.header.img_size);
  }

  #parseTLVs(offset, obj, expectedMagic) {
    // Grab the TLV area header
    const magic = this.#dataView.getUint16(offset, true);
    const tlvTot = this.#dataView.getUint16(offset + 2, true);
    const tlvEnd = offset + tlvTot;
    offset += 4;

    // Check magic is as expected
    if (magic !== expectedMagic) {
      throw new Error(`Error parsing TLV area, got magic ${magic}, expected ${expectedMagic}`);
    }

    while (offset < tlvEnd) {
      // Grab the TLV header
      const tlvType = this.#dataView.getUint16(offset, true);
      const tlvLen = this.#dataView.getUint16(offset + 2, true);
      offset += 4;

      // Save the contents
      obj[tlvType] = new Uint8Array(this.#buffer.buffer, offset, tlvLen);
      offset += tlvLen;
    }

    return offset;
  }

  async #validateSHA256() {
    // Calculate SHA256 of header + payload + protected TLVs
    const length = this.header.hdr_size + this.header.img_size + this.header.protect_tlv_size;
    const data = new Uint8Array(this.#buffer.buffer, 0, length);
    const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', data));

    // Get expected SHA256 from TLV
    const expected = this.getTLV(TLV_TYPE.SHA256);

    // Check they match
    return expected.every((v, i) => v === actual[i]);
  }
}
