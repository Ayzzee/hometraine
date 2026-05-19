function saveSessionToHistory() {
    if (state.pedalingTime < 10) {
        alert("Session trop courte pour être sauvegardée.");
        return;
    }

    const sessionSummary = {
        id: Date.now(),
        date: state.startTime.toISOString(),
        duration: state.pedalingTime,
        distance: state.totalDistanceM,
        avgWatts: Math.round(state.sumWatts / state.pedalingTime),
        avgSpeed: (state.sumSpeed / state.pedalingTime).toFixed(1),
        data: {
            time: [...state.sessionData.time],
            watts: [...state.sessionData.watts],
            speed: [...state.sessionData.speed]
        }
    };

    let histories = JSON.parse(localStorage.getItem('cyclodash_history') || '[]');
    const saveObj = {...sessionSummary};
    delete saveObj.data;
    histories.unshift(saveObj);
    
    if(histories.length > 20) histories.pop();
    
    localStorage.setItem('cyclodash_history', JSON.stringify(histories));
    
    if(confirm("Session terminée ! Voulez-vous télécharger le fichier Strava (.tcx) maintenant ?")) {
        exportTCX(sessionSummary);
    }

    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const histories = JSON.parse(localStorage.getItem('cyclodash_history') || '[]');
    
    if (histories.length === 0) return;
    
    list.innerHTML = '';
    histories.forEach(h => {
        const dateObj = new Date(h.date);
        const dateStr = dateObj.toLocaleDateString() + ' à ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div>
                <h3>Sortie du ${dateStr}</h3>
                <div class="history-meta">
                    ⏱ ${formatTime(h.duration)} | 📏 ${(h.distance/1000).toFixed(1)} km | ⚡ ${h.avgWatts} W moy | 🚴 ${h.avgSpeed} km/h
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function exportTCX(session) {
    const dateIso = session.date;
    let trackpoints = '';
    let currentDist = 0;
    const startD = new Date(session.date);

    for (let i = 0; i < session.data.time.length; i++) {
        const w = session.data.watts[i];
        const s = session.data.speed[i];
        currentDist += (s / 3.6);
        const ptDate = new Date(startD.getTime() + (i * 1000));
        
        trackpoints += `
    <Trackpoint>
      <Time>${ptDate.toISOString()}</Time>
      <DistanceMeters>${currentDist.toFixed(2)}</DistanceMeters>
      <Cadence>0</Cadence>
      <Extensions>
        <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
          <Watts>${Math.round(w)}</Watts>
          <Speed>${(s / 3.6).toFixed(2)}</Speed>
        </TPX>
      </Extensions>
    </Trackpoint>`;
    }

    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd" xmlns:ns5="http://www.garmin.com/xmlschemas/Routing/v1" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2" xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2" xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
  <Activities>
    <Activity Sport="Biking">
      <Id>${dateIso}</Id>
      <Lap StartTime="${dateIso}">
        <TotalTimeSeconds>${session.duration}</TotalTimeSeconds>
        <DistanceMeters>${session.distance.toFixed(2)}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
            ${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const blob = new Blob([tcx], {type: "application/vnd.garmin.tcx+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CycloDash_${dateIso.replace(/[:.]/g, '-')}.tcx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Expose functions globally
window.saveSessionToHistory = saveSessionToHistory;
window.renderHistory = renderHistory;
window.exportTCX = exportTCX;
