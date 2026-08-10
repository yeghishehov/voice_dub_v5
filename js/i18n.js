// js/i18n.js - Internationalization (i18n) Module (English & Russian)

export const I18N = {
    en: {
        // Top Navigation Bar & Header
        appTitle: "VOICE DUB V5",
        appSubtitle: "Client-side Web Audio & AI Video Dubbing",
        apiKeyLabel: "Gemini API Key:",
        apiKeyPlaceholder: "Paste your Gemini API key (AIzaSy...)",
        langToggleBtn: "🌐 RU",

        // Stepper Stage Titles
        step1Title: "1. Import",
        step2Title: "2. Transcription",
        step3Title: "3. Translation",
        step4Title: "4. Voiceover (TTS)",
        step5Title: "5. Export Hub",

        // Stage 1: Import
        stage1Header: "Stage 1: Import Video & Scripts",
        stage1Desc: "Upload your video/audio file or directly import ready original/translated script files to skip steps.",
        dropVideoTitle: "Select or drag Video / Audio file",
        dropVideoDesc: "MP4, WebM, MOV, AVI, MKV or MP3, WAV, M4A",
        importOrigTextBtn: "📝 Import Original Script",
        importTransTextBtn: "🌐 Import Translated Script",
        nextTranscriptionBtn: "Next: Transcription ➡️",

        // File Info Card
        videoPreviewTitle: "Loaded File",
        specFile: "File:",
        specDuration: "Duration:",
        specResolution: "Resolution:",
        specFormat: "Format:",

        // Stage 2: Transcription
        stage2Header: "Stage 2: Speech Transcription (Gemini Flash)",
        sourceLangLabel: "Source Language:",
        startTranscriptionBtn: "⚡ Start Transcription (Gemini)",
        nextTranslationBtn: "Next: Translation ➡️",
        backBtn: "⬅️ Back",

        // Stage 3: Translation
        stage3Header: "Stage 3: Translation to Target Language",
        targetLangLabel: "Target Language:",
        startTranslationBtn: "🌐 Translate Script (Gemini)",
        nextVoiceoverBtn: "Next: Voiceover ➡️",

        // Stage 4: Voiceover (TTS)
        stage4Header: "Stage 4: Speech Synthesis (Edge TTS)",
        ttsLangLabel: "Voiceover Language:",
        defaultVoiceLabel: "Default Speaker Voice:",
        startTTSBtn: "🎙️ Synthesize All Phrases (Edge TTS)",
        nextExportBtn: "Next: Export ➡️",

        // Phrases Table
        thNum: "#",
        thStart: "Start",
        thEnd: "End",
        thSource: "Original Text (Editable)",
        thTarget: "Translation (Stage 3)",
        thVoice: "Speaker Voice",
        thAudio: "Audio",

        // Stage 5: Export Hub
        stage5Header: "Stage 5: Export Hub",
        stage5Desc: "Download all project assets in your preferred format.",
        cardStitchedTitle: "Stitched Audio (.wav)",
        cardStitchedDesc: "Single dubbing audio track synced with timestamps for CapCut.",
        downloadAudioBtn: "🎵 Download Dubbed Audio (.wav)",
        cardOrigTitle: "Original Text",
        cardOrigDesc: "Subtitles / transcription of original speech.",
        cardTransTitle: "Translated Text",
        cardTransDesc: "Translated script with timestamps.",
        cardIndivTitle: "Individual Audio Clips",
        cardIndivDesc: "Separate MP3 audio clips for each phrase.",
        exportIndivBtn: "📦 Download Individual Audio (.mp3)",

        // Alert Messages
        noPhrasesAlert: "No phrases available! Please import or transcribe speech first.",
        missingOrigTextAlert: "Original text missing! Complete Stage 2 (Transcription) or import original script.",
        missingTransTextAlert: "Translated text missing! Complete Stage 3 (Translation) or import translated script.",
        missingAudioBlobAlert: "Dubbed audio track is not generated yet! Run Stage 4 (Voiceover) first.",
        missingIndividualAudioAlert: "Run Stage 4 (Voiceover) first to generate phrase audio files!",
        emptyPhraseAlert: "Phrase text is empty!",
        enterApiKeyAlert: "🔑 Please enter your Gemini API Key in the top field of the page!"
    },
    ru: {
        // Top Navigation Bar & Header
        appTitle: "VOICE DUB V5",
        appSubtitle: "Клиентский дубляж видео на базе ИИ",
        apiKeyLabel: "API ключ Gemini:",
        apiKeyPlaceholder: "Вставьте ваш API ключ Gemini (AIzaSy...)",
        langToggleBtn: "🌐 EN",

        // Stepper Stage Titles
        step1Title: "1. Импорт",
        step2Title: "2. Транскрибация",
        step3Title: "3. Перевод",
        step4Title: "4. Озвучка (TTS)",
        step5Title: "5. Центр экспорта",

        // Stage 1: Import
        stage1Header: "Этап 1: Импорт медиафайла и текстов",
        stage1Desc: "Загрузите исходное видео/аудио или сразу импортируйте готовый текст оригинала/перевода для пропуска этапов.",
        dropVideoTitle: "Выберите или перетащите файл Видео / Аудио",
        dropVideoDesc: "MP4, WebM, MOV, AVI, MKV или MP3, WAV, M4A",
        importOrigTextBtn: "📝 Импортировать оригинальный текст",
        importTransTextBtn: "🌐 Импортировать переведенный текст",
        nextTranscriptionBtn: "Далее: Транскрибация ➡️",

        // File Info Card
        videoPreviewTitle: "Загруженный файл",
        specFile: "Файл:",
        specDuration: "Длительность:",
        specResolution: "Разрешение:",
        specFormat: "Формат:",

        // Stage 2: Transcription
        stage2Header: "Этап 2: Транскрибация речи (Gemini Flash)",
        sourceLangLabel: "Исходный язык речи:",
        startTranscriptionBtn: "⚡ Начать транскрибацию (Gemini)",
        nextTranslationBtn: "Далее: Перевод ➡️",
        backBtn: "⬅️ Назад",

        // Stage 3: Translation
        stage3Header: "Этап 3: Перевод на целевой язык",
        targetLangLabel: "Целевой язык:",
        startTranslationBtn: "🌐 Перевести фразы (Gemini)",
        nextVoiceoverBtn: "Далее: Озвучка ➡️",

        // Stage 4: Voiceover (TTS)
        stage4Header: "Этап 4: Синтез речи (Edge TTS)",
        ttsLangLabel: "Язык озвучки:",
        defaultVoiceLabel: "Голос диктора по умолчанию:",
        startTTSBtn: "🎙️ Озвучить все фразы (Edge TTS)",
        nextExportBtn: "Далее: Экспорт ➡️",

        // Phrases Table
        thNum: "#",
        thStart: "Начало",
        thEnd: "Конец",
        thSource: "Исходный текст (можно редактировать)",
        thTarget: "Перевод (Этап 3)",
        thVoice: "Голос диктора",
        thAudio: "Аудио",

        // Stage 5: Export Hub
        stage5Header: "Этап 5: Центр экспорта",
        stage5Desc: "Скачивайте любые готовые материалы вашего проекта в нужном формате.",
        cardStitchedTitle: "Склеенное аудио (.wav)",
        cardStitchedDesc: "Единый аудиофайл дубляжа со скомпонованными фразами по таймкодам для CapCut.",
        downloadAudioBtn: "🎵 Скачать аудиодорожку (.wav)",
        cardOrigTitle: "Оригинальный текст",
        cardOrigDesc: "Субтитры / расшифровка исходной речи.",
        cardTransTitle: "Переведенный текст",
        cardTransDesc: "Переведенный сценарий с таймкодами.",
        cardIndivTitle: "Отдельные аудиофрагменты",
        cardIndivDesc: "Файлы каждой фразы отдельными MP3 файлами.",
        exportIndivBtn: "📦 Скачать отдельные аудио (.mp3)",

        // Alert Messages
        noPhrasesAlert: "Нет фраз для экспорта! Сначала выполните импорт или транскрибацию.",
        missingOrigTextAlert: "Оригинальный текст отсутствует! Выполните этап 2 (Транскрибация) или импортируйте оригинальный текст на этапе 1.",
        missingTransTextAlert: "Переведенный текст отсутствует! Выполните этап 3 (Перевод) или импортируйте переведенный текст на этапе 1.",
        missingAudioBlobAlert: "Склеенная аудиодорожка еще не скомпонована! Выполните этап 4 (Озвучка).",
        missingIndividualAudioAlert: "Сначала выполните этап 4 (Озвучка) для генерации аудиофайлов фраз!",
        emptyPhraseAlert: "Текст фразы пуст!",
        enterApiKeyAlert: "🔑 Пожалуйста, введите ваш Gemini API ключ в верхнем поле страницы!"
    }
};
