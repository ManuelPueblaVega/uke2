const TUNINGS = {
    "standard": {
        "G4": 392.00,
        "C4": 261.63,
        "E4": 329.63,
        "A4": 440.00
    },
    "c-tuning": {
        "G3": 196.00,
        "C4": 261.63,
        "E4": 329.63,
        "A4": 440.00
    },
    "d-tuning": {
        "A4": 440.00,
        "D4": 293.66,
        "F#4": 369.99,
        "B4": 493.88
    }
};

let audioContext = null;
let analyser = null;
let microphone = null;
let currentTuning = TUNINGS.standard;
let frequencyHistory = [];

// Inicialización del micrófono
async function initMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        microphone.connect(analyser);
        return true;
    } catch (error) {
        alert("Error al acceder al micrófono: " + error);
        return false;
    }
}

// Detección de frecuencia con suavizado
function getSmoothFrequency() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
        }
    }

    const frequency = (maxIndex * audioContext.sampleRate) / bufferLength;
    frequencyHistory.push(frequency);
    if (frequencyHistory.length > 5) frequencyHistory.shift();
    return frequencyHistory.reduce((a, b) => a + b) / frequencyHistory.length;
}

// Encontrar la nota más cercana
function findClosestNote(frequency) {
    let closestNote = null;
    let minDifference = Infinity;

    Object.entries(currentTuning).forEach(([note, targetFreq]) => {
        const difference = Math.abs(frequency - targetFreq);
        if (difference < minDifference) {
            minDifference = difference;
            closestNote = { note, targetFreq };
        }
    });

    return closestNote;
}

// Dibujar el indicador visual
function drawGauge(detectedFreq, targetFreq) {
    const canvas = document.getElementById('gauge');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height - 50;

    // Fondo del indicador
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 100, 0, Math.PI, false);
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#ddd';
    ctx.stroke();

    // Aguja
    const percent = (detectedFreq - targetFreq) / targetFreq;
    const angle = Math.PI * 0.8 * percent;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(angle) * 80,
        centerY - Math.sin(angle) * 80
    );
    ctx.lineWidth = 5;
    ctx.strokeStyle = Math.abs(percent) < 0.01 ? 'green' : 
                     percent > 0 ? 'orange' : 'red';
    ctx.stroke();
}

// Bucle principal de afinación
async function tuningLoop() {
    if (!analyser) return;

    const detectedFreq = getSmoothFrequency();
    const closest = findClosestNote(detectedFreq);
    
    if (closest) {
        const { note, targetFreq } = closest;
        const difference = detectedFreq - targetFreq;
        const tolerance = 1; // Hz de tolerancia

        document.getElementById('note-display').textContent = note;
        
        if (Math.abs(difference) < tolerance) {
            document.getElementById('status').innerHTML = `✅ ¡Afinado! ${note} (${detectedFreq.toFixed(1)} Hz)`;
            document.getElementById('status').style.color = 'green';
        } else {
            document.getElementById('status').innerHTML = `Desafinado: ${difference > 0 ? '🔼 Muy alto' : '🔽 Muy bajo'}`;
            document.getElementById('status').style.color = difference > 0 ? 'orange' : 'red';
        }

        drawGauge(detectedFreq, targetFreq);
    }

    requestAnimationFrame(tuningLoop);
}

// Inicialización
document.getElementById('tuning-selector').addEventListener('change', (e) => {
    currentTuning = TUNINGS[e.target.value];
    document.getElementById('status').textContent = `Afinación cambiada a ${e.target.options[e.target.selectedIndex].text}`;
});

(async () => {
    const success = await initMicrophone();
    if (success) {
        tuningLoop();
        document.getElementById('status').textContent = 'Micrófono listo - Toca una cuerda';
    }
})();