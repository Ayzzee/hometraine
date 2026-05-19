let sessionTickInterval = null;
let chartInstance = null;

function initChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    Chart.defaults.color = '#94a3b8';
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [
                { label: 'Puissance (W)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], yAxisID: 'y' },
                { label: 'Vitesse (km/h)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.0)', data: [], yAxisID: 'y1' }
            ] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, animation: false,
            elements: { point: { radius: 0 } },
            scales: { 
                y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Watts'} },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'km/h'} }
            } 
        }
    });
}

function startSession() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    state.isRecording = true;
    state.startTime = new Date();
    state.pedalingTime = 0; 
    state.totalDistanceM = 0; 
    state.sumWatts = 0; 
    state.sumSpeed = 0;
    state.maxWatts = 0; 
    state.maxSpeed = 0;
    state.currentWorkoutStepIndex = 0; 
    state.workoutStepTimeElapsed = 0;
    
    state.sessionData.time = []; 
    state.sessionData.watts = []; 
    state.sessionData.speed = [];
    
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    
    // Reset extra stats display
    document.getElementById('wattsMaxVal').innerText = "0";
    document.getElementById('speedMaxVal').innerText = "0.0";
    document.getElementById('caloriesVal').innerText = "0";
    document.getElementById('workVal').innerText = "0";
    
    sessionTickInterval = setInterval(tick, 1000);
}

function stopSession() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const connectionControls = document.getElementById('connectionControls');
    const sessionControls = document.getElementById('sessionControls');
    const statusTxt = document.getElementById('status');

    state.isRecording = false;
    state.stopTime = new Date();
    clearInterval(sessionTickInterval);
    
    if (state.isDemoMode) {
        clearInterval(state.demoInterval);
        state.isDemoMode = false;
    }
    
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    document.getElementById('workoutBanner').classList.remove('active');
    
    connectionControls.style.display = 'flex';
    sessionControls.style.display = 'none';
    statusTxt.innerText = "Prêt à scanner";
    
    saveSessionToHistory();
}

function tick() {
    if (!state.isRecording) return;

    if (state.currentWatts > 0 || state.currentSpeed > 0.5) {
        state.pedalingTime += 1;
        state.sumWatts += state.currentWatts;
        state.sumSpeed += state.currentSpeed;
        state.totalDistanceM += (state.currentSpeed / 3.6);
    }

    if (state.pedalingTime > 0) {
        state.maxWatts = Math.max(state.maxWatts, state.currentWatts);
        state.maxSpeed = Math.max(state.maxSpeed, state.currentSpeed);
        const workKJ = state.sumWatts / 1000;
        const caloriesKcal = workKJ * 1.0;

        document.getElementById('avgWattsVal').innerText = `Moyenne: ${Math.round(state.sumWatts / state.pedalingTime)} W`;
        document.getElementById('avgSpeedVal').innerText = `Moyenne: ${(state.sumSpeed / state.pedalingTime).toFixed(1)} km/h`;
        document.getElementById('durationVal').innerText = formatTime(state.pedalingTime);
        document.getElementById('distanceVal').innerText = `${(state.totalDistanceM / 1000).toFixed(2)} km`;
        
        // Update new stats cards
        document.getElementById('wattsMaxVal').innerText = Math.round(state.maxWatts);
        document.getElementById('speedMaxVal').innerText = state.maxSpeed.toFixed(1);
        document.getElementById('caloriesVal').innerText = Math.round(caloriesKcal);
        document.getElementById('workVal').innerText = Math.round(workKJ);
        
        const wCard = document.getElementById('wattsCard');
        let zoneStr = 'Z1';
        if (state.currentWatts > state.ftp * 1.2) zoneStr = 'Z6';
        else if (state.currentWatts > state.ftp * 1.05) zoneStr = 'Z5';
        else if (state.currentWatts > state.ftp * 0.9) zoneStr = 'Z4';
        else if (state.currentWatts > state.ftp * 0.75) zoneStr = 'Z3';
        else if (state.currentWatts > state.ftp * 0.55) zoneStr = 'Z2';
        
        wCard.style.borderBottom = `4px solid ${getZoneColor(zoneStr)}`;
    }

    updateWorkoutBanner();

    state.sessionData.time.push(state.pedalingTime);
    state.sessionData.watts.push(state.currentWatts);
    state.sessionData.speed.push(state.currentSpeed);

    const displayLen = 600;
    chartInstance.data.labels = state.sessionData.time.slice(-displayLen).map(t => formatTime(t));
    chartInstance.data.datasets[0].data = state.sessionData.watts.slice(-displayLen);
    chartInstance.data.datasets[1].data = state.sessionData.speed.slice(-displayLen);
    chartInstance.update();
}

// Expose variables and functions globally
window.sessionTickInterval = sessionTickInterval;
window.chartInstance = chartInstance;
window.initChart = initChart;
window.startSession = startSession;
window.stopSession = stopSession;
window.tick = tick;
