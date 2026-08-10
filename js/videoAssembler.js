// js/videoAssembler.js - Web Audio Mixing & Video Subtitle Compositor

export class VideoAssembler {
    /**
     * Calculates anti-collision start times for audio phrases.
     * @param {Array<Object>} phrases 
     * @returns {Array<Object>}
     */
    static calculateTimings(phrases) {
        let lastEnd = 0.0;
        let shiftedCount = 0;

        const timedPhrases = phrases.map((phrase) => {
            const targetStart = phrase.startSec || 0;
            const startAt = Math.max(targetStart, lastEnd);
            if (startAt > targetStart) {
                shiftedCount++;
            }
            const duration = phrase.audioDuration || 2.0;
            lastEnd = startAt + duration;

            return {
                ...phrase,
                actualStartSec: startAt,
                actualEndSec: lastEnd,
                duration: duration
            };
        });

        return { timedPhrases, shiftedCount, totalDuration: lastEnd };
    }

    /**
     * Mixes synthesized TTS audio tracks with background video audio using Web Audio API OfflineAudioContext.
     * @param {Array<Object>} timedPhrases 
     * @param {AudioBuffer|null} origAudioBuffer 
     * @param {number} totalVideoDuration 
     * @param {string} mixMode "Заменить оригинал" | "Микшировать с оригиналом"
     * @param {function(string):void} progressCb 
     * @returns {Promise<Blob>}
     */
    static async mixAudioTracks(timedPhrases, origAudioBuffer, totalVideoDuration, mixMode = "Заменить оригинал", progressCb = console.log) {
        progressCb("🔧 Сборка и микширование звуковых дорожек...");

        const sampleRate = 44100;
        const totalDuration = Math.max(
            totalVideoDuration,
            timedPhrases.length > 0 ? timedPhrases[timedPhrases.length - 1].actualEndSec : 0
        );

        const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

        // 1. Add background original audio if requested
        if (mixMode !== "Заменить оригинал" && origAudioBuffer) {
            const bgSource = offlineCtx.createBufferSource();
            bgSource.buffer = origAudioBuffer;

            const gainNode = offlineCtx.createGain();
            gainNode.gain.value = 0.15; // 15% background volume ducking

            bgSource.connect(gainNode);
            gainNode.connect(offlineCtx.destination);
            bgSource.start(0);
        }

        // 2. Add each phrase audio buffer
        let loadedCount = 0;
        for (const phrase of timedPhrases) {
            if (!phrase.audioBlob) continue;

            try {
                const arrayBuffer = await phrase.audioBlob.arrayBuffer();
                const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
                const phraseBuffer = await tempCtx.decodeAudioData(arrayBuffer);
                tempCtx.close();

                const phraseSource = offlineCtx.createBufferSource();
                phraseSource.buffer = phraseBuffer;

                const gainNode = offlineCtx.createGain();
                gainNode.gain.value = 1.0;

                phraseSource.connect(gainNode);
                gainNode.connect(offlineCtx.destination);
                phraseSource.start(phrase.actualStartSec);

                loadedCount++;
            } catch (err) {
                console.warn(`Could not decode audio phrase #${phrase.id}:`, err);
            }
        }

        progressCb(`🎛️ Загружено ${loadedCount} звуковых фрагментов для микширования...`);

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = this.audioBufferToWav(renderedBuffer);

        progressCb("✅ Микширование звука завершено!");
        return wavBlob;
    }

    /**
     * Converts AudioBuffer to WAV Blob
     */
    static audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
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

        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

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
        let index = 0, inputIndex = 0;
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

    /**
     * Draws formatted subtitles onto HTML5 Canvas element.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} text 
     * @param {number} width 
     * @param {number} height 
     */
    static drawSubtitle(ctx, text, width, height) {
        if (!text) return;

        const fontSize = Math.max(18, Math.floor(height * 0.045));
        ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const maxPx = width * 0.85;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxPx && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = fontSize * 1.3;
        const startY = height - 40 - (lines.length - 1) * lineHeight;

        lines.forEach((line, index) => {
            const y = startY + index * lineHeight;

            // Background pill box
            const m = ctx.measureText(line);
            const pWidth = m.width + 24;
            const pHeight = fontSize * 1.3;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(width / 2 - pWidth / 2, y - fontSize - 4, pWidth, pHeight, 8);
            } else {
                ctx.rect(width / 2 - pWidth / 2, y - fontSize - 4, pWidth, pHeight);
            }
            ctx.fill();

            // Text stroke outline & fill
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeText(line, width / 2, y);

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(line, width / 2, y);
        });
    }

    /**
     * Records canvas video frames and mixed dubbed audio track into a single downloadable video Blob (.webm / .mp4).
     * @param {HTMLVideoElement} video 
     * @param {HTMLCanvasElement} canvas 
     * @param {Blob} mixedAudioBlob 
     * @param {Array<Object>} timedPhrases 
     * @param {function(string):void} progressCb 
     * @returns {Promise<Blob>}
     */
    static async recordDubbedVideo(video, canvas, mixedAudioBlob, timedPhrases, progressCb = console.log) {
        return new Promise(async (resolve, reject) => {
            try {
                progressCb("🎬 Подготовка записи видеопотока с дубляжом...");

                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await mixedAudioBlob.arrayBuffer();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

                const audioSource = audioCtx.createBufferSource();
                audioSource.buffer = audioBuffer;

                const audioDestination = audioCtx.createMediaStreamDestination();
                audioSource.connect(audioDestination);

                const canvasStream = canvas.captureStream(30);
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioDestination.stream.getAudioTracks()
                ]);

                let mimeType = 'video/webm';
                if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
                    mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
                } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                }

                const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 4000000 });
                const recordedChunks = [];

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        recordedChunks.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    audioCtx.close();
                    const videoBlob = new Blob(recordedChunks, { type: mimeType });
                    progressCb("✅ Запись готового видеофайла завершена!");
                    resolve(videoBlob);
                };

                video.currentTime = 0;
                video.muted = true;

                const totalDuration = video.duration || audioBuffer.duration;

                const checkTimeInterval = setInterval(() => {
                    const pct = Math.min(100, Math.floor((video.currentTime / totalDuration) * 100));
                    progressCb(`🎬 Рендеринг и запись видео: ${pct}%`);

                    if (video.currentTime >= totalDuration - 0.2 || video.ended) {
                        clearInterval(checkTimeInterval);
                        video.pause();
                        recorder.stop();
                    }
                }, 400);

                await video.play();
                audioSource.start(0);
                recorder.start(100);

            } catch (err) {
                reject(err);
            }
        });
    }
}
