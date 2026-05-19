function debugLog(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

async function connectTrainer() {
    const statusTxt = document.getElementById('status');
    const connectionControls = document.getElementById('connectionControls');
    const sessionControls = document.getElementById('sessionControls');
    
    try {
        statusTxt.innerText = "Recherche d'appareils...";
        state.device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'TURNO' }, { namePrefix: 'MISURO' }, { namePrefix: 'ELITE' }],
            optionalServices: [0x1818, 0x1816]
        });
        
        statusTxt.innerText = `Connexion à ${state.device.name}...`;
        state.server = await state.device.gatt.connect();

        try {
            const powerService = await state.server.getPrimaryService(0x1818);
            const powerChar = await powerService.getCharacteristic(0x2a63);
            await powerChar.startNotifications();
            powerChar.addEventListener('characteristicvaluechanged', (e) => {
                state.currentWatts = e.target.value.getUint16(2, true);
                document.getElementById('wattsVal').innerText = state.currentWatts;
            });
        } catch(e) { debugLog("Puissance non dispo", "warn"); }

        try {
            const speedService = await state.server.getPrimaryService(0x1816);
            const speedChar = await speedService.getCharacteristic(0x2a5b);
            await speedChar.startNotifications();
            speedChar.addEventListener('characteristicvaluechanged', (e) => {
                const data = e.target.value;
                const cumulativeWheelRevs = data.getUint32(1, true);
                const lastWheelEventTime = data.getUint16(5, true);

                if (state.lastWheelRevs !== null) {
                    let dRevs = cumulativeWheelRevs - state.lastWheelRevs;
                    let dTime = lastWheelEventTime - state.lastWheelTime;
                    if (dTime < 0) dTime += 65536;
                    if (dRevs < 0) dRevs += 4294967296;

                    if (dTime > 0) {
                        const timeS = dTime / 1024.0;
                        const dist = dRevs * config.WHEEL_CIRCUMFERENCE_M;
                        state.currentSpeed = (dist / timeS) * 3.6;
                        document.getElementById('speedVal').innerText = state.currentSpeed.toFixed(1);
                    }
                }
                state.lastWheelRevs = cumulativeWheelRevs;
                state.lastWheelTime = lastWheelEventTime;
            });
        } catch(e) { debugLog("Vitesse non dispo", "warn"); }

        statusTxt.innerText = `Connecté à ${state.device.name}`;
        connectionControls.style.display = 'none';
        sessionControls.style.display = 'flex';
        
    } catch (error) {
        statusTxt.innerText = "Erreur de connexion";
        alert(error.message);
    }
}

function startDemo() {
    const statusTxt = document.getElementById('status');
    const connectionControls = document.getElementById('connectionControls');
    const sessionControls = document.getElementById('sessionControls');
    
    state.isDemoMode = true;
    connectionControls.style.display = 'none';
    sessionControls.style.display = 'flex';
    statusTxt.innerText = "Connecté (Mode Démo)";
    
    state.currentWatts = 180;
    
    state.demoInterval = setInterval(() => {
        let targetWatts = 180;
        
        // Si un entraînement structuré est actif, on simule l'effort ciblé
        if (state.activeWorkout && state.isRecording) {
            const step = state.activeWorkout.steps[state.currentWorkoutStepIndex];
            if (step) {
                // Déterminer la puissance cible moyenne selon la zone
                switch(step.type) {
                    case 'Z1': targetWatts = state.ftp * 0.50; break;
                    case 'Z2': targetWatts = state.ftp * 0.65; break;
                    case 'Z3': targetWatts = state.ftp * 0.83; break;
                    case 'Z4': targetWatts = state.ftp * 0.98; break;
                    case 'Z5': targetWatts = state.ftp * 1.13; break;
                    case 'Z6': targetWatts = state.ftp * 1.30; break;
                    default: targetWatts = state.ftp * 0.70;
                }
            }
        }
        
        // Variations aléatoires douces autour de la cible
        const noise = (Math.random() * 16 - 8); // +/- 8 W
        state.currentWatts = Math.max(20, Math.round(targetWatts + noise));
        
        // Formule physique de corrélation plate : Vitesse (km/h) = Racine Cubique(Watts / 0.007)
        if (state.currentWatts > 0) {
            state.currentSpeed = Math.pow(state.currentWatts / 0.007, 1/3);
        } else {
            state.currentSpeed = 0;
        }
        
        // Un peu de bruit sur la vitesse
        state.currentSpeed += (Math.random() * 0.4 - 0.2);

        document.getElementById('wattsVal').innerText = Math.round(state.currentWatts);
        document.getElementById('speedVal').innerText = state.currentSpeed.toFixed(1);
    }, 1000);
}

// Expose functions globally
window.debugLog = debugLog;
window.connectTrainer = connectTrainer;
window.startDemo = startDemo;
