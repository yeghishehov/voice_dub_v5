// api/drm.js - JavaScript implementation of Edge TTS DRM (Sec-MS-GEC v2)
// Matches edge_tts.drm.generate_sec_ms_gec_v2

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600n;
const S_TO_NS_DIV_100 = 10000000n;

const _SHA256_INITIAL = [
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
];

const _SHA256_STATE = [
    0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A,
    0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2
];

const _SHA256_SCHEDULE = [
    0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA,
    0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6,
    0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33,
    0xD258B060, 0x72766564
];

const _SHA256_ROUND_CONSTANTS = [
    0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
    0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
    0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
    0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
    0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
    0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
    0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
    0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
];

const _SHA256_ADJUSTMENT = 0xC9DC06A7;
const _SHA256_BLOCK_CONSTANTS = [
    ..._SHA256_ROUND_CONSTANTS.slice(0, 14),
    _SHA256_ADJUSTMENT,
    ..._SHA256_ROUND_CONSTANTS.slice(15)
];

const _SHA256_SIGMA0_ADJUSTMENT = 0x059C0B80;
const _SHA256_SIGMA1_ADJUSTMENT = 0x000B92C0;

const _CS64_COEFFICIENTS = [
    [0xE82E91B1, 0xB32700D0],
    [0x44DE24C6, 0x88DFF51D],
    [0x3BEB65BC, 0x29514038],
    [0xC89C5933, 0xB328CBDF],
    [0x8D1EC211, 0xD405B4D5],
    [0x314EF5D5, 0x26E55F3C],
    [0xE92491B1, 0x607801C6],
    [0xF0A5B9D5, 0x82B2C1FB],
    [0x06064CF3, 0xFA51A3DA],
    [0xDA79FA60, 0x207CC464],
    [0xBED20560, 0x3C3C74F3],
    [0x89F9C9F8, 0xD2D14B61],
    [0x35FA38C6, 0xBB04A2C1],
    [0xCB49E3C6, 0xC5626167]
];

const _CS64_FACTOR = 0x82893933;
const _CS64_ADJUSTMENT0 = 0xF2F90B1A;
const _CS64_ADJUSTMENT1 = 0x0B1A0000;

function u32(val) {
    return Number(BigInt(val) & 0xFFFFFFFFn);
}

function mul32(a, b) {
    return Number((BigInt(a) * BigInt(b)) & 0xFFFFFFFFn);
}

function _rol16(value) {
    const v = u32(value);
    return ((v << 16) | (v >>> 16)) >>> 0;
}

function _words_le4_even(data) {
    const padLen = (4 - (data.length % 4)) % 4;
    const padded = Buffer.concat([data, Buffer.alloc(padLen, 0)]);
    const words = [];
    for (let i = 0; i < padded.length; i += 4) {
        words.push(padded.readUInt32LE(i));
    }
    if (words.length % 2 !== 0) {
        words.push(0);
    }
    return words;
}

function _sigma0(value) {
    const v = u32(value);
    return ((v >>> 7) ^ (v << 25) ^ (v >>> 18) ^ (v << 14) ^ (v >>> 3)) >>> 0;
}

function _sigma1(value) {
    const v = u32(value);
    return ((v >>> 17) ^ (v << 15) ^ (v >>> 19) ^ (v << 13) ^ (v >>> 10)) >>> 0;
}

function _expand_sha256_schedule(words, first_word = 16) {
    for (let index = first_word; index < 64; index++) {
        const x = words[index - 2];
        const y = words[index - 15];
        const s1 = ((x >>> 17) ^ (x << 15) ^ (x >>> 19) ^ (x << 13) ^ (x >>> 10)) >>> 0;
        const s0 = ((y >>> 7) ^ (y << 25) ^ (y >>> 18) ^ (y << 14) ^ (y >>> 3)) >>> 0;
        words.push(u32(BigInt(s1) + BigInt(words[index - 7]) + BigInt(s0) + BigInt(words[index - 16])));
    }
}

function _sha256_rounds(state, words, first_round = 0) {
    let [a, b, c, d, e, f, g, h] = state;
    const constants = first_round === 14 ? _SHA256_BLOCK_CONSTANTS : _SHA256_ROUND_CONSTANTS;
    const aligned = Math.min(64, Math.ceil(first_round / 8) * 8);

    for (let index = first_round; index < aligned; index++) {
        const rot_e = (BigInt(e) * 0x100000001n);
        const rot_a = (BigInt(a) * 0x100000001n);
        const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
        const ch = (g ^ (e & (f ^ g))) >>> 0;
        const t1 = u32(BigInt(h) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index]) + BigInt(words[index]));
        
        const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
        const maj = ((a & b) | (c & (a | b))) >>> 0;
        const t2 = u32(BigInt(rotr_a) + BigInt(maj));

        [a, b, c, d, e, f, g, h] = [
            u32(BigInt(t1) + BigInt(t2)),
            a,
            b,
            c,
            u32(BigInt(d) + BigInt(t1)),
            e,
            f,
            g
        ];
    }

    for (let index = aligned; index < 64; index += 8) {
        // Round 0
        {
            const rot_e = BigInt(e) * 0x100000001n;
            const rot_a = BigInt(a) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (g ^ (e & (f ^ g))) >>> 0;
            const t1 = u32(BigInt(h) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index]) + BigInt(words[index]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((a & b) | (c & (a | b))) >>> 0;
            d = u32(BigInt(d) + BigInt(t1));
            h = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 1
        {
            const rot_e = BigInt(d) * 0x100000001n;
            const rot_a = BigInt(h) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (f ^ (d & (e ^ f))) >>> 0;
            const t1 = u32(BigInt(g) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 1]) + BigInt(words[index + 1]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((h & a) | (b & (h | a))) >>> 0;
            c = u32(BigInt(c) + BigInt(t1));
            g = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 2
        {
            const rot_e = BigInt(c) * 0x100000001n;
            const rot_a = BigInt(g) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (e ^ (c & (d ^ e))) >>> 0;
            const t1 = u32(BigInt(f) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 2]) + BigInt(words[index + 2]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((g & h) | (a & (g | h))) >>> 0;
            b = u32(BigInt(b) + BigInt(t1));
            f = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 3
        {
            const rot_e = BigInt(b) * 0x100000001n;
            const rot_a = BigInt(f) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (d ^ (b & (c ^ d))) >>> 0;
            const t1 = u32(BigInt(e) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 3]) + BigInt(words[index + 3]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((f & g) | (h & (f | g))) >>> 0;
            a = u32(BigInt(a) + BigInt(t1));
            e = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 4
        {
            const rot_e = BigInt(a) * 0x100000001n;
            const rot_a = BigInt(e) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (c ^ (a & (b ^ c))) >>> 0;
            const t1 = u32(BigInt(d) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 4]) + BigInt(words[index + 4]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((e & f) | (g & (e | f))) >>> 0;
            h = u32(BigInt(h) + BigInt(t1));
            d = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 5
        {
            const rot_e = BigInt(h) * 0x100000001n;
            const rot_a = BigInt(d) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (b ^ (h & (a ^ b))) >>> 0;
            const t1 = u32(BigInt(c) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 5]) + BigInt(words[index + 5]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((d & e) | (f & (d | e))) >>> 0;
            g = u32(BigInt(g) + BigInt(t1));
            c = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 6
        {
            const rot_e = BigInt(g) * 0x100000001n;
            const rot_a = BigInt(c) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (a ^ (g & (h ^ a))) >>> 0;
            const t1 = u32(BigInt(b) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 6]) + BigInt(words[index + 6]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((c & d) | (e & (c | d))) >>> 0;
            f = u32(BigInt(f) + BigInt(t1));
            b = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
        // Round 7
        {
            const rot_e = BigInt(f) * 0x100000001n;
            const rot_a = BigInt(b) * 0x100000001n;
            const rotr_e = Number(((rot_e >> 6n) ^ (rot_e >> 11n) ^ (rot_e >> 25n)) & 0xFFFFFFFFn);
            const ch = (h ^ (f & (g ^ h))) >>> 0;
            const t1 = u32(BigInt(a) + BigInt(rotr_e) + BigInt(ch) + BigInt(constants[index + 7]) + BigInt(words[index + 7]));
            const rotr_a = Number(((rot_a >> 2n) ^ (rot_a >> 13n) ^ (rot_a >> 22n)) & 0xFFFFFFFFn);
            const maj = ((b & c) | (d & (b | c))) >>> 0;
            e = u32(BigInt(e) + BigInt(t1));
            a = u32(BigInt(t1) + BigInt(rotr_a) + BigInt(maj));
        }
    }

    return [a, b, c, d, e, f, g, h];
}

function _sha256_init(data) {
    const w14 = (data[0] << 16) | (data[1] << 8) | data[2];
    const w15 = (data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6];
    const words = new Array(14).fill(0).concat([w14 >>> 0, w15 >>> 0]);

    for (let index = 16; index < 30; index++) {
        let value = BigInt(_SHA256_SCHEDULE[index - 16]);
        if (index - 2 >= 14) {
            const s1 = _sigma1(words[index - 2]);
            value += BigInt(index === 16 ? (s1 ^ _SHA256_SIGMA1_ADJUSTMENT) >>> 0 : s1);
        }
        if (index - 7 >= 14) {
            value += BigInt(words[index - 7]);
        }
        if (index - 15 >= 14) {
            const s0 = _sigma0(words[index - 15]);
            value += BigInt(index === 29 ? (s0 ^ _SHA256_SIGMA0_ADJUSTMENT) >>> 0 : s0);
        }
        words.push(u32(value));
    }

    const w30 = u32(
        BigInt(_sigma1(words[28])) +
        BigInt(words[23]) +
        BigInt(_sigma0(words[15])) +
        BigInt(words[14]) +
        BigInt(_SHA256_ADJUSTMENT) -
        BigInt(_SHA256_ROUND_CONSTANTS[14])
    );
    words.push(w30);

    _expand_sha256_schedule(words, 31);
    const working = _sha256_rounds(_SHA256_STATE, words, 14);
    return _SHA256_INITIAL.map((x, i) => u32(BigInt(x) + BigInt(working[i])));
}

function _sha256_digest(data) {
    if (data.length < 7) {
        throw new Error("Token salt must contain at least seven bytes");
    }
    const length = 57 + data.length;
    const zeroPadCount = ((55 - length) % 64 + 64) % 64;
    const lenBuf = Buffer.alloc(8);
    lenBuf.writeBigUInt64BE(BigInt(length * 8), 0);

    const padded = Buffer.concat([
        data.subarray(7),
        Buffer.from([0x80]),
        Buffer.alloc(zeroPadCount, 0),
        lenBuf
    ]);

    let state = _sha256_init(data.subarray(0, 7));
    for (let offset = 0; offset < padded.length; offset += 64) {
        const words = [];
        for (let i = 0; i < 64; i += 4) {
            words.push(padded.readUInt32BE(offset + i));
        }
        _expand_sha256_schedule(words, 16);
        const working = _sha256_rounds(state, words, 0);
        state = state.map((x, i) => u32(BigInt(x) + BigInt(working[i])));
    }

    const digestBuf = Buffer.alloc(32);
    for (let i = 0; i < 8; i++) {
        digestBuf.writeUInt32BE(state[i], i * 4);
    }
    return digestBuf;
}

function _cs64_digest(data, digest) {
    let key_a = digest.readUInt32LE(0) | 1;
    let key_b = digest.readUInt32LE(4) | 1;

    const factors = [
        mul32(key_a, _CS64_FACTOR),
        mul32(key_b, _CS64_FACTOR)
    ];

    const terms = _CS64_COEFFICIENTS.map(([coeff, _], idx) => 
        mul32(coeff, factors[idx % 2])
    );
    const offsets = _CS64_COEFFICIENTS.map(([_, off]) => off);

    const leWords = _words_le4_even(Buffer.concat([Buffer.from([0]), data]));
    leWords.forEach((word, idx) => {
        let term = mul32(word, idx % 2 === 0 ? key_a : key_b);
        let offset = mul32(_rol16(word), idx % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
        if (idx === 0) {
            term = u32(BigInt(term) + (BigInt(_CS64_ADJUSTMENT0) * BigInt(factors[0])));
            offset = u32(BigInt(offset) + BigInt(_CS64_ADJUSTMENT1));
        }
        terms.push(term);
        offsets.push(offset);
    });

    let swap_acc = 0;
    let swap_last = 0;
    let state = 0;
    let acc = 0;

    for (let i = 0; i < terms.length; i += 2) {
        const x = terms[i];
        const y = terms[i + 1];

        let t = _rol16(u32(BigInt(offsets[i]) + BigInt(x)));
        let q = mul32(t, 0x76F50F34);
        swap_acc = u32(BigInt(swap_acc) + BigInt(mul32(_rol16(q), 0xC3EFEA97)) + BigInt(q));

        t = _rol16(u32(BigInt(offsets[i + 1]) + BigInt(y)));
        q = mul32(t, 0x1881CE3C);
        swap_last = u32(BigInt(mul32(_rol16(q), 0x35BD1EC9)) + BigInt(q));
        swap_acc = u32(BigInt(swap_acc) + BigInt(swap_last));

        state = mul32(_rol16(mul32(_rol16(mul32(_rol16(mul32(_rol16(u32(BigInt(mul32(state, key_a)) + BigInt(x))), 0xCF98B111)), 0x87085B9F)), 0x12CEB96D)), 0x257E1D83);
        acc = u32(BigInt(acc) + BigInt(state));

        t = mul32(_rol16(mul32(_rol16(u32(BigInt(mul32(state, key_b)) + BigInt(y))), 0xA27416F5)), 0xD38396FF);
        state = mul32(_rol16(mul32(_rol16(t), 0x7C932B89)), 0xBFA49F69);
        acc = u32(BigInt(acc) + BigInt(state));
    }

    return [(swap_last ^ state) >>> 0, (swap_acc ^ acc) >>> 0];
}

export function generateSecMsGecV2(unixTimestamp) {
    let nowSec = unixTimestamp !== undefined ? BigInt(Math.floor(unixTimestamp)) : BigInt(Math.floor(Date.now() / 1000));
    let ticks = nowSec + WIN_EPOCH;
    ticks -= (ticks % 300n);
    ticks *= S_TO_NS_DIV_100;

    const data = Buffer.from(`${ticks}${TRUSTED_CLIENT_TOKEN}`, 'ascii');
    const digest = _sha256_digest(data);
    const [w1, w2] = _cs64_digest(data, digest);

    const cs64Buf = Buffer.alloc(8);
    cs64Buf.writeUInt32LE(w1, 0);
    cs64Buf.writeUInt32LE(w2, 4);

    const cs64Hex = cs64Buf.toString('hex').toUpperCase();
    const sha256Hex = digest.toString('hex').toUpperCase();

    return `${cs64Hex}-${sha256Hex}`;
}
