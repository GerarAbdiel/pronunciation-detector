const wordInput = document.getElementById('wordInput');
const resultDiv = document.getElementById('result');
const youtubeDiv = document.getElementById('youtube-result');
const recordButton = document.getElementById('recordButton');
const API_KEY = 'AIzaSyBkbRzGGcr7HxwH8rYHXHc4_SAO_0yGl9k'; // Tu clave API

let mediaRecorder;
let audioChunks = [];
let cmuDict = null;

// Cargar cmudict.json al iniciar
async function loadCMUDict() {
    try {
        const response = await fetch('https://gerarabdiel.github.io/pronunciation-detector/cmudict.json');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        cmuDict = await response.json();
        resultDiv.innerHTML = "¡Listo para grabar! 🎙️";
    } catch (error) {
        resultDiv.innerHTML = "Error al cargar el diccionario: " + error.message;
    }
}

loadCMUDict();

// Normalizar texto
function normalizeText(text) {
    return text ? text.trim().toLowerCase().replace(/\s+/g, ' ') : 'nada';
}

// Iniciar grabación
recordButton.addEventListener('click', async () => {
    const targetWord = normalizeText(wordInput.value);
    if (!targetWord || targetWord === 'nada') {
        resultDiv.innerHTML = "Por favor, escribe una palabra.";
        return;
    }
    if (!cmuDict) {
        resultDiv.innerHTML = "Esperando carga del diccionario...";
        return;
    }
    if (!cmuDict[targetWord]) {
        resultDiv.innerHTML = `Error: "${targetWord}" no está en el diccionario fonético.`;
        return;
    }

    resultDiv.innerHTML = "Grabando... 🎙️";
    resultDiv.className = '';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioBase64 = await convertWebMToLinear16(audioBlob);
            const transcription = await transcribeAudio(audioBase64);
            processTranscription(transcription, targetWord);
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 3000);
    } catch (error) {
        resultDiv.innerHTML = "Error al usar el micrófono: " + error.message;
    }
});

// Convertir WebM a LINEAR16 Base64
async function convertWebMToLinear16(audioBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const fileReader = new FileReader();

        fileReader.onload = async () => {
            try {
                const arrayBuffer = fileReader.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const channelData = audioBuffer.getChannelData(0); // Mono
                const int16Array = new Int16Array(channelData.length);

                for (let i = 0; i < channelData.length; i++) {
                    int16Array[i] = Math.max(-32768, Math.min(32767, Math.round(channelData[i] * 32768)));
                }

                const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Array.buffer)));
                if (!base64) throw new Error('Base64 vacío');
                resolve(base64);
            } catch (error) {
                reject(new Error('Error al convertir audio: ' + error.message));
            }
        };

        fileReader.readAsArrayBuffer(audioBlob);
    });
}

// Transcribir audio con Google Speech-to-Text
async function transcribeAudio(audioBase64) {
    const request = {
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: false,
            enableWordTimeOffsets: false,
            model: 'default',
            maxAlternatives: 5
        },
        audio: { content: audioBase64 }
    };

    try {
        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.results ? data.results[0].alternatives : [];
    } catch (error) {
        resultDiv.innerHTML = "Error en la API: " + error.message;
        console.error('Detalles del error:', error.message);
        return [];
    }
}

// Procesar transcripción y comparar fonemas
function processTranscription(alternatives, targetWord) {
    const spokenWord = alternatives.length > 0 ? normalizeText(alternatives[0].transcript) : 'nada';
    const expectedPhonemes = cmuDict[targetWord];
    let detectedPhonemes = spokenWord in cmuDict ? cmuDict[spokenWord] : spokenWord;

    resultDiv.innerHTML = `Esperado: "${targetWord}" (fonemas: ${expectedPhonemes})<br>Detectado: "${spokenWord}" (fonemas: ${detectedPhonemes})`;

    if (spokenWord === 'nada') {
        resultDiv.innerHTML += "<br>❌ No se detectó voz.";
        resultDiv.className = 'incorrect';
    } else if (expectedPhonemes === detectedPhonemes) {
        resultDiv.innerHTML += "<br>✅ ¡Correcto!";
        resultDiv.className = 'correct';
    } else {
        resultDiv.innerHTML += `<br>❌ Incorrecto. Fonemas detectados: ${detectedPhonemes}`;
        resultDiv.className = 'incorrect';
    }

    showYouTubeLink(targetWord);
}

// Mostrar enlace de YouTube
function showYouTubeLink(word) {
    const searchQuery = encodeURIComponent(`${word} pronunciation`);
    youtubeDiv.innerHTML = `
        <p>📺 Pronunciación correcta:</p>
        <a href="https://www.youtube.com/results?search_query=${searchQuery}" target="_blank">
            Ver "${word}" en YouTube
        </a>
    `;
}
