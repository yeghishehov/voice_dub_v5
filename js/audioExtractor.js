// js/audioExtractor.js - Web Audio API Audio Extraction & Slicing

/**
 * Extracts and decodes audio from a video/audio file, then slices into chunks.
 */
export class AudioExtractor {
    /**
     * Decode audio buffer from File object.
     * @param {File} file 
     * @returns {Promise<AudioBuffer>}
     */
    static async decodeAudioFromFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();
        return decodedData;
    }

    /**
     * Slice an AudioBuffer into smaller chunk Blobs of specified duration (in seconds).
     * @param {AudioBuffer} audioBuffer 
     * @param {number} chunkSizeSec 
     * @param {function(string):void} progressCb 
     * @returns {Promise<Array<{startSec: number, blob: Blob, base64: string}>>}
     */
    static async extractChunks(audioBuffer, chunkSizeSec = 60, progressCb = console.log) {
        const sampleRate = audioBuffer.sampleRate;
        const numberOfChannels = audioBuffer.numberOfChannels;
        const totalDuration = audioBuffer.duration;
        const chunks = [];

        const samplesPerChunk = chunkSizeSec * sampleRate;
        const totalSamples = audioBuffer.length;
        const numChunks = Math.ceil(totalSamples / samplesPerChunk);

        progressCb(`✂️ Нарезка аудио на ${numChunks} фрагментов по ${chunkSizeSec} сек...`);

        for (let i = 0; i < numChunks; i++) {
            const startSample = i * samplesPerChunk;
            const endSample = Math.min((i + 1) * samplesPerChunk, totalSamples);
            const frameCount = endSample - startSample;

            // Create a sub-AudioBuffer for this chunk
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const chunkBuffer = audioCtx.createBuffer(numberOfChannels, frameCount, sampleRate);
            
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                const chunkChannelData = chunkBuffer.getChannelData(channel);
                chunkChannelData.set(channelData.subarray(startSample, endSample));
            }
            audioCtx.close();

            // Encode AudioBuffer to WAV Blob
            const wavBlob = this.bufferToWavBlob(chunkBuffer);
            const base64 = await this.blobToBase64(wavBlob);

            const startSec = i * chunkSizeSec;
            chunks.push({
                index: i,
                startSec: startSec,
                duration: frameCount / sampleRate,
                blob: wavBlob,
                base64: base64
            });

            progressCb(`✂️ Подготовлен фрагмент ${i + 1}/${numChunks} (${startSec}s)`);
        }

        return chunks;
    }

    /**
     * Encodes an AudioBuffer into PCM WAV Blob.
     * @param {AudioBuffer} buffer 
     * @returns {Blob}
     */
    static bufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        let result;
        if (numChannels === 2) {
            result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        const dataLength = result.length * 2;
        const bufferLength = 44 + dataLength;
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        /* RIFF identifier */
        this.writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + dataLength, true);
        /* RIFF type */
        this.writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        this.writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, format, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        /* bits per sample */
        view.setUint16(34, bitDepth, true);
        /* data chunk identifier */
        this.writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, dataLength, true);

        // Write PCM samples
        let offset = 44;
        for (let i = 0; i < result.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, result[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    static interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);
        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    static writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    static blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
