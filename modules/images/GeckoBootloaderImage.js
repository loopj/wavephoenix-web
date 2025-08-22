/**
 * Gecko Bootloader image format
 * See https://www.silabs.com/documents/public/user-guides/ug266-gecko-bootloader-user-guide.pdf
 */

// GBL format version
const GBL_VERSION = 0x03000000;

// Tag IDs
const GBL_TAG_ID_HEADER = 0x03a617eb;
const GBL_TAG_ID_VERSION_DEPENDENCY = 0x76a617eb;
const GBL_TAG_ID_APPLICATION_INFO = 0xf40a0af4;
const GBL_TAG_ID_SE_UPGRADE = 0x5ea617eb;
const GBL_TAG_ID_BOOTLOADER = 0xf50909f5;
const GBL_TAG_ID_PROGRAM_DATA = 0xfe0101fe;
const GBL_TAG_ID_PROGRAM_DATA2 = 0xfd0303fd;
const GBL_TAG_ID_DELTA = 0xf80a0af8;
const GBL_TAG_ID_PROGRAM_LZ4 = 0xfd0505fd;
const GBL_TAG_ID_DELTA_LZ4 = 0xf80b0bf8;
const GBL_TAG_ID_PROGRAM_LZMA = 0xfd0707fd;
const GBL_TAG_ID_DELTA_LZMA = 0xf80c0cf8;
const GBL_TAG_ID_METADATA = 0xf60808f6;
const GBL_TAG_ID_CERTIFICATE = 0xf30b0bf3;
const GBL_TAG_ID_SIGNATURE = 0xf70a0af7;
const GBL_TAG_ID_END = 0xfc0404fc;

function crc32(buf) {
  let crc = 0xffffffff;

  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export class GeckoBootloaderImage {
  #buffer;
  #dataView;

  headerTag;
  applicationInfoTag;
  programDataTags = [];
  endTag;

  constructor(buffer) {
    this.#buffer = buffer;
    this.#dataView = new DataView(buffer);

    let offset = 0;
    while (offset < this.#buffer.byteLength) {
      const tagType = this.#dataView.getUint32(offset, true);
      const tagLength = this.#dataView.getUint32(offset + 4, true);

      if (tagType === GBL_TAG_ID_HEADER) {
        this.headerTag = this.parseHeader(offset + 8, tagLength);
      } else if (tagType === GBL_TAG_ID_APPLICATION_INFO) {
        this.applicationInfoTag = this.parseApplicationInfo(offset + 8, tagLength);
      } else if (tagType === GBL_TAG_ID_PROGRAM_DATA || tagType === GBL_TAG_ID_PROGRAM_DATA2) {
        this.programDataTags.push(this.parseProgramData(offset + 8, tagLength));
      } else if (tagType === GBL_TAG_ID_END) {
        this.endTag = this.parseEnd(offset + 8, tagLength);
      }

      offset += 8 + tagLength;
    }
  }

  parseHeader(offset, length) {
    if (length !== 8) throw new Error("Invalid header tag length");

    return {
      version: this.#dataView.getUint32(offset, true),
      typeFlags: this.#dataView.getUint32(offset + 4, true),
    };
  }

  parseApplicationInfo(offset, length) {
    if (length !== 28) throw new Error("Invalid application info tag length");

    return {
      type: this.#dataView.getUint32(offset, true),
      version: this.#dataView.getUint32(offset + 4, true),
      capabilities: this.#dataView.getUint32(offset + 8, true),
      productId: new Uint8Array(this.#buffer, offset + 12, 16),
    };
  }

  parseProgramData(offset, length) {
    if (length < 4) throw new Error("Invalid program data tag length");

    return {
      flashStartAddress: this.#dataView.getUint32(offset, true),
      data: new Uint8Array(this.#buffer, offset + 4, length - 4),
    };
  }

  parseEnd(offset, length) {
    if (length !== 4) throw new Error("Invalid end tag length");

    return {
      crc32: this.#dataView.getUint32(offset, true),
    };
  }

  calculateCRC32() {
    return crc32(new Uint8Array(this.#buffer, 0, this.#buffer.byteLength - 4));
  }

  validateCRC32() {
    return this.calculateCRC32() === this.endTag.crc32;
  }

  isValid() {
    return this.headerTag && this.endTag && this.validateCRC32();
  }

  getApplicationVersion() {
    return this.applicationInfoTag?.version;
  }

  getApplicationVersionSemantic() {
    const version = this.getApplicationVersion();
    return {
      major: (version >> 24) & 0xff,
      minor: (version >> 16) & 0xff,
      patch: (version >> 8) & 0xff,
      build: version & 0xff,
    };
  }
}
