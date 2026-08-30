// js/i18n.js - Internationalization (i18n) Module (English & Russian)

export const I18N = {
    en: {
        // Document Title
        docTitle: "VOICE DUB v5 — Client-side Web Audio & AI Video Dubbing",

        // Top Navigation Bar & Header
        appTitle: "VOICE DUB V5",
        appSubtitle: "Client-side Web Audio & AI Video Dubbing",
        apiKeyLabel: "Gemini API Key:",
        apiKeyPlaceholder: "Paste your Gemini API key (AIzaSy...)",
        langToggleBtn: "🌐 RU",

        // Stepper Stage Titles & Subtitles
        step1Title: "1. Import",
        step1Sub: "Files & Text",
        step2Title: "2. Transcription",
        step2Sub: "Speech STT",
        step3Title: "3. Translation",
        step3Sub: "Translate script",
        step4Title: "4. Voiceover (TTS)",
        step4Sub: "Speech TTS",
        step5Title: "5. Export Hub",
        step5Sub: "Audio & Script",

        // Stage 1: Import
        stage1Header: "Stage 1: Import Video & Scripts",
        stage1Desc: "Upload your video/audio file or directly import ready original/translated script files to skip steps.",
        dropVideoTitle: "Select Video / Audio file",
        dropVideoDesc: "MP4, WebM, MOV, AVI, MKV or MP3, WAV, M4A",
        selectVideoBtn: "🎬 Select video file on computer",
        selectAnotherFileBtn: "📂 Select another file",
        selectedFileLabel: "✅ Selected file:",
        importOrigTextBtn: "📝 Import Original Script",
        importTransTextBtn: "🌐 Import Translated Script",
        nextTranscriptionBtn: "Next: Transcription ➡️",

        // File Info Card
        videoPreviewTitle: "Loaded File",
        specFile: "File:",
        specDuration: "Duration:",
        specResolution: "Resolution:",
        specFormat: "Format:",
        statusLoading: "Loading...",
        statusExtracting: "Extracting audio...",
        specAudioContainer: "Audio file / Container",

        // Stage 2: Transcription
        stage2Header: "Stage 2: Speech Transcription (Gemini Flash)",
        stage2Desc: "Click \"Start Transcription\" to extract speech with timestamps via Gemini API. Edit any phrase in the table.",
        sourceLangLabel: "Source Language:",
        startTranscriptionBtn: "⚡ Start Transcription (Gemini)",
        nextTranslationBtn: "Next: Translation ➡️",
        backBtn: "⬅️ Back",

        // Stage 3: Translation
        stage3Header: "Stage 3: Translation to Target Language",
        stage3Desc: "Translation is performed in batches using Gemini API. Modify translation text in the table anytime.",
        targetLangLabel: "Target Language:",
        startTranslationBtn: "🌐 Translate Script (Gemini)",
        nextVoiceoverBtn: "Next: Voiceover ➡️",

        // Stage 4: Voiceover (TTS)
        stage4Header: "Stage 4: Speech Synthesis (Edge TTS)",
        stage4Desc: "Speech synthesis is powered directly by Microsoft Edge TTS neural voices. Preview each phrase in the table.",
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
        playTooltip: "Play",
        reTtsTooltip: "Generate / Regenerate phrase",

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
        backToVoiceoverBtn: "⬅️ Back to Voiceover",

        // Language Select Options
        langArmenian: "Armenian",
        langRussian: "Russian",
        langEnglish: "English",
        langPersian: "Persian",
        langSpanish: "Spanish",
        langEgyptian: "Egyptian Arabic",

        // Footer
        footerText: "VOICE DUB v5 — Pure Frontend Client-Side Video Dubbing Application",

        // Alert Messages
        noPhrasesAlert: "No phrases available! Please import or transcribe speech first.",
        missingOrigTextAlert: "Original text missing! Complete Stage 2 (Transcription) or import original script.",
        missingTransTextAlert: "Translated text missing! Complete Stage 3 (Translation) or import translated script.",
        missingAudioBlobAlert: "Dubbed audio track is not generated yet! Run Stage 4 (Voiceover) first.",
        missingIndividualAudioAlert: "Run Stage 4 (Voiceover) first to generate phrase audio files!",
        emptyPhraseAlert: "Phrase text is empty!",
        enterApiKeyAlert: "🔑 Please enter your Gemini API Key in the top field of the page!",

        // Log & Unit Labels
        logFileLoaded: "📂 Loaded file:",
        logSelectedFile: "✅ Selected file:",
        logAudioDecoding: "⚡ Decoding audio track from video via Web Audio API...",
        logAudioExtracted: "✂️ Audio buffer extracted:",
        logTranscriptionFailed: "❌ Transcription failed:",
        logTranslationFailed: "❌ Translation failed:",
        logAutoAssembly: "🎛️ Auto assembling single audio track (.wav)...",
        logTtsFailed: "❌ Speech synthesis failed:",
        logSynthesizingPhrase: "🎙️ Synthesizing phrase #",
        logPhraseSuccess: "✅ Phrase #",
        logPhraseSuccessSuffix: "successfully voiced!",
        logPhraseError: "❌ Error voicing phrase #",
        logTimingsCalculated: "📊 Calculated timings for",
        logShiftedOverlaps: "phrases. Shifted due to overlaps:",
        logAssemblyCompleted: "🎉 Audio track (.wav) assembly completed! Click green card below to download.",
        logAssemblyFailed: "❌ Audio assembly error:",
        logImportSuccess: "📝 Successfully imported",
        logImportError: "❌ Text import error:",
        logDownloadIndividual: "📦 Downloading",
        logDownloadIndividualSuffix: "phrase audio files...",
        translationLoadedInfo: "✨ Translation loaded! Stages 4 (Voiceover) and 5 (Export) are now available.",
        minsLabel: "min",
        secsLabel: "sec"
    },
    ru: {
        // Document Title
        docTitle: "VOICE DUB v5 — Клиентский дубляж видео в браузере",

        // Top Navigation Bar & Header
        appTitle: "VOICE DUB V5",
        appSubtitle: "Клиентский дубляж видео на базе ИИ",
        apiKeyLabel: "API ключ Gemini:",
        apiKeyPlaceholder: "Вставьте ваш API ключ Gemini (AIzaSy...)",
        langToggleBtn: "🌐 EN",

        // Stepper Stage Titles & Subtitles
        step1Title: "1. Импорт",
        step1Sub: "Файлы и Текст",
        step2Title: "2. Транскрибация",
        step2Sub: "Транскрибация",
        step3Title: "3. Перевод",
        step3Sub: "Перевод сценария",
        step4Title: "4. Озвучка (TTS)",
        step4Sub: "Синтез речи",
        step5Title: "5. Центр экспорта",
        step5Sub: "Аудио и Текст",

        // Stage 1: Import
        stage1Header: "Этап 1: Импорт медиафайла и текстов",
        stage1Desc: "Загрузите исходное видео/аудио или сразу импортируйте готовый текст оригинала/перевода для пропуска этапов.",
        dropVideoTitle: "Выберите файл Видео / Аудио",
        dropVideoDesc: "MP4, WebM, MOV, AVI, MKV или MP3, WAV, M4A",
        selectVideoBtn: "🎬 Выбрать видеофайл на компьютере",
        selectAnotherFileBtn: "📂 Выбрать другой файл",
        selectedFileLabel: "✅ Выбран файл:",
        importOrigTextBtn: "📝 Импортировать оригинальный текст",
        importTransTextBtn: "🌐 Импортировать переведенный текст",
        nextTranscriptionBtn: "Далее: Транскрибация ➡️",

        // File Info Card
        videoPreviewTitle: "Загруженный файл",
        specFile: "Файл:",
        specDuration: "Длительность:",
        specResolution: "Разрешение:",
        specFormat: "Формат:",
        statusLoading: "Загрузка...",
        statusExtracting: "В процессе извлечения...",
        specAudioContainer: "Аудиофайл / Контейнер",

        // Stage 2: Transcription
        stage2Header: "Этап 2: Транскрибация речи (Gemini Flash)",
        stage2Desc: "Нажмите \"Начать транскрибацию\" для извлечения речи с таймкодами через Gemini API. Редактируйте фразы в таблице.",
        sourceLangLabel: "Исходный язык речи:",
        startTranscriptionBtn: "⚡ Начать транскрибацию (Gemini)",
        nextTranslationBtn: "Далее: Перевод ➡️",
        backBtn: "⬅️ Назад",

        // Stage 3: Translation
        stage3Header: "Этап 3: Перевод на целевой язык",
        stage3Desc: "Перевод выполняется пакетами через Gemini API. Редактируйте текст перевода в таблице в любое время.",
        targetLangLabel: "Целевой язык:",
        startTranslationBtn: "🌐 Перевести фразы (Gemini)",
        nextVoiceoverBtn: "Далее: Озвучка ➡️",

        // Stage 4: Voiceover (TTS)
        stage4Header: "Этап 4: Синтез речи (Edge TTS)",
        stage4Desc: "Синтез речи выполняется нейросетевыми голосами Microsoft Edge TTS. Прослушивайте каждую фразу в таблице.",
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
        playTooltip: "Прослушать",
        reTtsTooltip: "Сгенерировать / Перегенерировать фразу",

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
        backToVoiceoverBtn: "⬅️ Назад к озвучке",

        // Language Select Options
        langArmenian: "Армянский",
        langRussian: "Русский",
        langEnglish: "Английский",
        langPersian: "Персидский",
        langSpanish: "Испанский",
        langEgyptian: "Египетский арабский",

        // Footer
        footerText: "VOICE DUB v5 — Клиентское веб-приложение для дубляжа видео на ИИ",

        // Alert Messages
        noPhrasesAlert: "Нет фраз для экспорта! Сначала выполните импорт или транскрибацию.",
        missingOrigTextAlert: "Оригинальный текст отсутствует! Выполните этап 2 (Транскрибация) или импортируйте оригинальный текст на этапе 1.",
        missingTransTextAlert: "Переведенный текст отсутствует! Выполните этап 3 (Перевод) или импортируйте переведенный текст на этапе 1.",
        missingAudioBlobAlert: "Склеенная аудиодорожка еще не скомпонована! Выполните этап 4 (Озвучка).",
        missingIndividualAudioAlert: "Сначала выполните этап 4 (Озвучка) для генерации аудиофайлов фраз!",
        emptyPhraseAlert: "Текст фразы пуст!",
        enterApiKeyAlert: "🔑 Пожалуйста, введите ваш Gemini API ключ в верхнем поле страницы!",

        // Log & Unit Labels
        logFileLoaded: "📂 Загружен файл:",
        logSelectedFile: "✅ Выбран файл:",
        logAudioDecoding: "⚡ Декодирование аудиодорожки из видео через Web Audio API...",
        logAudioExtracted: "✂️ Извлечен аудиобуфер:",
        logTranscriptionFailed: "❌ Сбой транскрибации:",
        logTranslationFailed: "❌ Сбой перевода:",
        logAutoAssembly: "🎛️ Автоматическая компоновка единой аудиодорожки (.wav)...",
        logTtsFailed: "❌ Сбой синтеза речи:",
        logSynthesizingPhrase: "🎙️ Генерация фразы #",
        logPhraseSuccess: "✅ Фраза #",
        logPhraseSuccessSuffix: "успешно озвучена!",
        logPhraseError: "❌ Ошибка озвучки фразы #",
        logTimingsCalculated: "📊 Рассчитаны тайминги для",
        logShiftedOverlaps: "фраз. Сдвинуто из-за наложений:",
        logAssemblyCompleted: "🎉 Сборка аудиодорожки (.wav) завершена! Нажмите зеленый блок ниже для скачивания.",
        logAssemblyFailed: "❌ Ошибка сборки аудиодорожки:",
        logImportSuccess: "📝 Успешно импортирован",
        logImportError: "❌ Ошибка импорта текста:",
        logDownloadIndividual: "📦 Скачивание",
        logDownloadIndividualSuffix: "аудиофайлов фраз...",
        translationLoadedInfo: "✨ Загружен перевод! Доступны этапы 4 (Озвучка) и 5 (Экспорт)",
        minsLabel: "мин",
        secsLabel: "сек"
    }
};
