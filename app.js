const wordInput = document.getElementById('wordInput');
const resultDiv = document.getElementById('result');
const youtubeDiv = document.getElementById('youtube-result');
const recordButton = document.getElementById('recordButton');
const API_KEY = 'AIzaSyBkbRzGGcr7HxwH8rYHXHc4_SAO_0yGl9k'; // Reemplaza con tu clave API de Google Speech-to-Text

let mediaRecorder;
let audioChunks = [];
let cmuDict = null;

// Cargar cmudict.json al iniciar
async function loadCMUDict() {
    try {
        const response = await fetch('cmudict.json'); // Ajusta la ruta si es necesario
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
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioBase64 = await convertAudioToBase64(audioBlob);
            const transcription = await transcribeAudio(audioBase64);
            processTranscription(transcription, targetWord);
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 3000); // Grabar por 3 segundos
    } catch (error) {
        resultDiv.innerHTML = "Error al usar el micrófono: " + error.message;
    }
});

// Convertir audio a base64
async function convertAudioToBase64(audioBlob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(audioBlob);
    });
}

// Transcribir audio con la API de Google
async function transcribeAudio(audioBase64) {
    const request = {
        config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: false,
            model: 'command_and_search',
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

        const data = await response.json();
        return data.results ? data.results[0].alternatives : [];
    } catch (error) {
        resultDiv.innerHTML = "Error en la API: " + error.message;
        return [];
    }
}

// Procesar transcripción y comparar fonemas
function processTranscription(alternatives, targetWord) {
    const spokenWord = alternatives.length > 0 ? normalizeText(alternatives[0].transcript) : 'nada';
    const expectedPhonemes = cmuDict[targetWord];
    let detectedPhonemes = spokenWord in cmuDict ? cmuDict[spokenWord] : spokenWord;

    resultDiv.innerHTML = `Esperado: "${targetWord}" (fonemas: ${expectedPhonemes})<br>Detectado: "${spokenWord}" (fonemas: ${detectedPhonemes})`;

    if (expectedPhonemes === detectedPhonemes) {
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
