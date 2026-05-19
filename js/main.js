// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Dynamically bind button clicks to keep code clean and modular
    const connectBtn = document.getElementById('connectBtn');
    const demoBtn = document.getElementById('demoBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (connectBtn) connectBtn.onclick = connectTrainer;
    if (demoBtn) demoBtn.onclick = startDemo;
    if (startBtn) startBtn.onclick = startSession;
    if (stopBtn) stopBtn.onclick = stopSession;

    loadSettings();
    renderHistory();
    initChart();
});

// --- SETTINGS LOGIC ---
function loadSettings() {
    const savedFtp = localStorage.getItem('userFTP');
    const demoBtn = document.getElementById('demoBtn');
    
    if (savedFtp) {
        state.ftp = parseInt(savedFtp);
        const ftpInput = document.getElementById('ftpInput');
        if (ftpInput) ftpInput.value = state.ftp;
        updateZonesDisplay();
    }
    
    // Developer Mode check
    const devMode = localStorage.getItem('devMode') === 'true';
    const devModeToggle = document.getElementById('devModeToggle');
    if (devModeToggle) devModeToggle.checked = devMode;
    if (demoBtn) demoBtn.style.display = devMode ? 'block' : 'none';
}

function updateZonesDisplay() {
    const zonesDisplay = document.getElementById('zonesDisplay');
    if (!zonesDisplay) return;
    
    zonesDisplay.style.display = 'block';
    document.getElementById('z1Val').innerText = `< ${Math.round(state.ftp * 0.55)} W`;
    document.getElementById('z2Val').innerText = `${Math.round(state.ftp * 0.55)} - ${Math.round(state.ftp * 0.75)} W`;
    document.getElementById('z3Val').innerText = `${Math.round(state.ftp * 0.76)} - ${Math.round(state.ftp * 0.90)} W`;
    document.getElementById('z4Val').innerText = `${Math.round(state.ftp * 0.91)} - ${Math.round(state.ftp * 1.05)} W`;
    document.getElementById('z5Val').innerText = `${Math.round(state.ftp * 1.06)} - ${Math.round(state.ftp * 1.20)} W`;
    document.getElementById('z6Val').innerText = `> ${Math.round(state.ftp * 1.20)} W`;
}

window.updateZonesDisplay = updateZonesDisplay;

// --- GLOBAL EXPORTS FOR INLINE HTML EVENT HANDLERS ---
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.add('active');
    
    const targetBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`);
    if (targetBtn) targetBtn.classList.add('active');
};

window.saveSettings = function() {
    const ftpInput = document.getElementById('ftpInput');
    if (!ftpInput) return;
    
    const val = ftpInput.value;
    if (val && parseInt(val) > 0) {
        state.ftp = parseInt(val);
        localStorage.setItem('userFTP', state.ftp);
        updateZonesDisplay();
        alert('Paramètres enregistrés !');
    }
};

window.toggleDevMode = function() {
    const devModeToggle = document.getElementById('devModeToggle');
    const demoBtn = document.getElementById('demoBtn');
    if (!devModeToggle) return;
    
    const checked = devModeToggle.checked;
    localStorage.setItem('devMode', checked ? 'true' : 'false');
    if (demoBtn) demoBtn.style.display = checked ? 'block' : 'none';
};

// --- SERVICE WORKER REGISTRATION & AUTO-RELOAD ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                window.location.reload();
                            }
                        }
                    };
                };
            })
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
