// VOICE_DUB_V5 Config & Constants

export const CONFIG = {
    DEFAULT_API_KEY: "",
    MODEL_ID: "gemini-3.1-flash-lite", // Matching VOICE_DUB_V4

    // Voice mappings (Edge TTS neural voices)
    VOICES: {
        "Русский": {
            "Мужской (Dmitry)": "ru-RU-DmitryNeural",
            "Женский (Svetlana)": "ru-RU-SvetlanaNeural",
            "Мужской Multilingual (Andrew)": "en-US-AndrewMultilingualNeural",
            "Мужской Multilingual (Brian)": "en-US-BrianMultilingualNeural",
            "Женский Multilingual (Emma)": "en-US-EmmaMultilingualNeural",
            "Женский Multilingual (Ava)": "en-US-AvaMultilingualNeural",
        },
        "Английский": {
            "Женский (Aria)": "en-US-AriaNeural",
            "Женский (Jenny)": "en-US-JennyNeural",
            "Мужской (Guy)": "en-US-GuyNeural",
            "Мужской (Andrew Multilingual)": "en-US-AndrewMultilingualNeural",
            "Мужской (Brian Multilingual)": "en-US-BrianMultilingualNeural",
            "Мужской (Christopher)": "en-US-ChristopherNeural",
            "Женский (Emma Multilingual)": "en-US-EmmaMultilingualNeural",
        },
        "Персидский": {
            "Мужской (Farid)": "fa-IR-FaridNeural",
            "Женский (Dilara)": "fa-IR-DilaraNeural",
        },
        "Испанский": {
            "Мужской (Alvaro)": "es-ES-AlvaroNeural",
            "Женский (Elvira)": "es-ES-ElviraNeural",
            "Женский (Ximena)": "es-ES-XimenaNeural",
        },
        "Египетский": {
            "Мужской (Shakir)": "ar-EG-ShakirNeural",
            "Женский (Salma)": "ar-EG-SalmaNeural",
        },
    },

    LANG_CODES: {
        "Русский": "ru",
        "Английский": "en",
        "Персидский": "fa",
        "Испанский": "es",
        "Египетский": "ar",
    },

    LANG_NAMES: {
        "Русский": "Russian",
        "Английский": "English",
        "Персидский": "Persian (Farsi)",
        "Испанский": "Spanish",
        "Египетский": "Egyptian Arabic (Masri dialect)",
    },

    LANG_FILE_NAMES: {
        "Русский": "Russian",
        "Английский": "English",
        "Персидский": "Persian",
        "Испанский": "Spanish",
        "Египетский": "Egyptian",
        "Армянский": "Armenian"
    },

    SOURCE_LANGS: {
        "Армянский": {
            "csv_name": "armenian",
            "col_name": "Армянский",
            "prompt_lang": "Armenian (Armenian alphabet)",
        },
        "Русский": {
            "csv_name": "russian",
            "col_name": "Русский",
            "prompt_lang": "Russian (Cyrillic alphabet)",
        },
    }
};
