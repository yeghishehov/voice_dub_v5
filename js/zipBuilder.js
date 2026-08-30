// js/zipBuilder.js - Zero-Dependency Pure JavaScript ZIP Creator (Store Mode)

export class ZipBuilder {
    static crc32Table = null;

    static getCRC32Table() {
        if (this.crc32Table) return this.crc32Table;
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        this.crc32Table = table;
        return table;
    }

    static calculateCRC32(bytes) {
        const table = this.getCRC32Table();
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Creates a ZIP Blob from an array of files.
     * @param {Array<{name: string, data: Uint8Array}>} files 
     * @returns {Blob}
     */
    static createZip(files) {
        const localHeaders = [];
        const centralHeaders = [];
        let offset = 0;

        for (const file of files) {
            const fileNameBytes = new TextEncoder().encode(file.name);
            const fileData = file.data;
            const crc = this.calculateCRC32(fileData);
            const size = fileData.length;

            // Local Header (30 bytes + filename + data)
            const lh = new Uint8Array(30 + fileNameBytes.length + size);
            const lhView = new DataView(lh.buffer);
            lhView.setUint32(0, 0x04034b50, true); // Local header signature
            lhView.setUint16(4, 20, true);         // Version needed to extract (2.0)
            lhView.setUint16(6, 0, true);          // General purpose bit flag
            lhView.setUint16(8, 0, true);          // Compression method (0 = Store)
            lhView.setUint16(10, 0, true);         // File last modification time
            lhView.setUint16(12, 0, true);         // File last modification date
            lhView.setUint32(14, crc, true);       // CRC-32 checksum
            lhView.setUint32(18, size, true);      // Compressed size
            lhView.setUint32(22, size, true);      // Uncompressed size
            lhView.setUint16(26, fileNameBytes.length, true); // File name length
            lhView.setUint16(28, 0, true);         // Extra field length
            lh.set(fileNameBytes, 30);
            lh.set(fileData, 30 + fileNameBytes.length);
            localHeaders.push(lh);

            // Central Directory Header (46 bytes + filename)
            const ch = new Uint8Array(46 + fileNameBytes.length);
            const chView = new DataView(ch.buffer);
            chView.setUint32(0, 0x02014b50, true); // Central header signature
            chView.setUint16(4, 20, true);         // Version made by
            chView.setUint16(6, 20, true);         // Version needed to extract
            chView.setUint16(8, 0, true);          // General purpose bit flag
            chView.setUint16(10, 0, true);         // Compression method (0)
            chView.setUint16(12, 0, true);         // File last modification time
            chView.setUint16(14, 0, true);         // File last modification date
            chView.setUint32(16, crc, true);       // CRC-32
            chView.setUint32(20, size, true);      // Compressed size
            chView.setUint32(24, size, true);      // Uncompressed size
            chView.setUint16(28, fileNameBytes.length, true); // File name length
            chView.setUint16(30, 0, true);         // Extra field length
            chView.setUint16(32, 0, true);         // File comment length
            chView.setUint16(34, 0, true);         // Disk number start
            chView.setUint16(36, 0, true);         // Internal file attributes
            chView.setUint32(38, 0, true);         // External file attributes
            chView.setUint32(42, offset, true);   // Relative offset of local header
            ch.set(fileNameBytes, 46);
            centralHeaders.push(ch);

            offset += lh.length;
        }

        const centralDirectoryOffset = offset;
        let centralDirectorySize = 0;
        for (const ch of centralHeaders) {
            centralDirectorySize += ch.length;
        }

        // End of Central Directory Record (EOCDR) (22 bytes)
        const eocdr = new Uint8Array(22);
        const eocdrView = new DataView(eocdr.buffer);
        eocdrView.setUint32(0, 0x06054b50, true); // EOCDR signature
        eocdrView.setUint16(4, 0, true);          // Number of this disk
        eocdrView.setUint16(6, 0, true);          // Disk where central directory starts
        eocdrView.setUint16(8, files.length, true); // Number of central directory records on this disk
        eocdrView.setUint16(10, files.length, true); // Total number of central directory records
        eocdrView.setUint32(12, centralDirectorySize, true);   // Size of central directory
        eocdrView.setUint32(16, centralDirectoryOffset, true); // Offset of central directory
        eocdrView.setUint16(20, 0, true);          // ZIP file comment length

        const parts = [...localHeaders, ...centralHeaders, eocdr];
        return new Blob(parts, { type: 'application/zip' });
    }
}
