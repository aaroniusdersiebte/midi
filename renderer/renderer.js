// renderer/renderer.js - Main entry point
// Modulare MIDI Controller App

// Global state - IMMEDIATELY available
window.APP_STATE = {
    midiAccess: null,
    midiInput: null,
    audioChannels: [],
    hotkeys: [],
    currentEditIndex: -1,
    midiLearnMode: null,
    midiLearnType: null,
    resizing: false,
    obsWebSocket: null,
    audioContext: null,
    virtualCableOutput: null,
    masterVolume: 70,
    masterPreviewing: false,
    animationFrame: null,
    isNativeAudio: false
};

// Global app reference for easier access
const app = window.APP_STATE;

// Initialize the app
async function init() {
    console.log('🎵 Initializing MIDI Controller App...');
    
    try {
        // Check audio status first
        await checkAudioStatus();
        
        // Initialize modules in order
        await window.MIDIController.init(app);
        console.log('✅ MIDI initialized');
        
        await window.ConfigManager.init(app);
        console.log('✅ Config initialized');
        
        await window.AudioMixer.init(app);
        console.log('✅ Audio mixer initialized');
        
        await window.HotkeyManager.init(app);
        console.log('✅ Hotkey manager initialized');
        
        await window.OBSController.init(app);
        console.log('✅ OBS controller initialized');
        
        await window.UIManager.init(app);
        console.log('✅ UI manager initialized');
        
        // Start monitoring and animations
        await startMonitoring();
        console.log('✅ Monitoring started');
        
        console.log('🎉 App initialization complete');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        window.Utils.showNotification('Initialisierung fehlgeschlagen: ' + error.message, 'error');
    }
}

// Check audio status
async function checkAudioStatus() {
    if (window.electronAPI && window.electronAPI.getAudioStatus) {
        const status = await window.electronAPI.getAudioStatus();
        app.isNativeAudio = status.isNativeAvailable;
        
        if (!status.isNativeAvailable) {
            window.Utils.showNotification('Audio läuft im Mock-Modus. Führe "npm run setup" aus für echte Audio-Kontrolle.', 'warning');
        }
    }
}

// Start monitoring
async function startMonitoring() {
    // Start audio level monitoring
    await window.electronAPI.startLevelMonitor();
    
    // Listen for audio levels
    window.electronAPI.onAudioLevels((data) => {
        window.AudioMixer.updateVUMeters(data);
    });
    
    // Start VU meter animation
    window.AudioMixer.startVUAnimation(app);
}

// Cleanup function
function cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (app.animationFrame) {
        cancelAnimationFrame(app.animationFrame);
    }
    
    if (window.electronAPI) {
        window.electronAPI.stopLevelMonitor();
        window.electronAPI.removeAudioLevelsListener();
    }
    
    if (app.obsWebSocket) {
        app.obsWebSocket.disconnect();
    }
    
    if (app.audioContext && app.audioContext.state !== 'closed') {
        app.audioContext.close();
    }
}

// ===========================================
// GLOBAL FUNCTIONS FOR ONCLICK HANDLERS
// ===========================================

// Settings
window.openSettings = function() {
    window.ConfigManager.openSettings(app);
};

window.saveSettings = function() {
    window.ConfigManager.saveSettings(app);
};

// Modal management
window.closeModal = function(modalId) {
    window.Utils.closeModal(modalId);
};

// Audio Channel functions
window.addAudioChannel = function() {
    window.AudioMixer.addChannel(app);
};

window.editAudioChannel = function(index) {
    window.AudioMixer.editChannel(app, index);
};

window.saveAudioChannel = function() {
    window.AudioMixer.saveChannel(app);
};

window.deleteAudioChannel = function(index) {
    window.AudioMixer.deleteChannel(app, index);
};

window.toggleMute = function(channelId) {
    window.AudioMixer.toggleMute(app, channelId);
};

window.togglePreview = function(channelId) {
    window.AudioMixer.togglePreview(app, channelId);
};

window.startVolumeDrag = function(event, channelId) {
    window.AudioMixer.startVolumeDrag(app, event, channelId);
};

// Hotkey functions
window.addHotkey = function() {
    window.HotkeyManager.addHotkey(app);
};

window.editHotkey = function(index) {
    window.HotkeyManager.editHotkey(app, index);
};

window.saveHotkey = function() {
    window.HotkeyManager.saveHotkey(app);
};

window.deleteHotkey = function(index) {
    window.HotkeyManager.deleteHotkey(app, index);
};

// MIDI functions
window.startMidiLearn = function(type) {
    window.MIDIController.startLearn(app, type);
};

// Master controls
window.toggleMasterPreview = function() {
    window.AudioMixer.toggleMasterPreview(app);
};

window.startMasterVolumeDrag = function(event) {
    window.AudioMixer.startMasterVolumeDrag(app, event);
};

// Hotkey configuration
window.updateActionConfig = function() {
    window.HotkeyManager.updateActionConfig(app);
};

window.selectAudioFile = function() {
    window.HotkeyManager.selectAudioFile();
};

// Testing functions
window.testMIDIConnection = function() {
    window.MIDIController.testConnection(app);
};

window.testOBSConnection = function() {
    const url = document.getElementById('obsWebsocket').value;
    const password = document.getElementById('obsPassword').value;
    if (url) {
        window.OBSController.testConnection(app, url, password);
    } else {
        window.Utils.showNotification('Bitte gib eine OBS WebSocket URL ein', 'error');
    }
};

// Configuration functions
window.exportConfig = function() {
    window.ConfigManager.exportConfig(app);
};

window.importConfig = function() {
    document.getElementById('importFileInput').click();
};

window.handleImportFile = function(event) {
    const file = event.target.files[0];
    if (file) {
        window.ConfigManager.importConfig(app, file);
    }
    event.target.value = ''; // Reset input
};

window.resetConfig = function() {
    window.ConfigManager.resetConfig(app);
};

// Window control functions
window.minimizeWindow = function() {
    if (window.electronAPI && window.electronAPI.minimizeWindow) {
        window.electronAPI.minimizeWindow();
    }
};

window.maximizeWindow = function() {
    if (window.electronAPI && window.electronAPI.maximizeWindow) {
        window.electronAPI.maximizeWindow();
    }
};

window.closeWindow = function() {
    if (window.electronAPI && window.electronAPI.closeWindow) {
        window.electronAPI.closeWindow();
    }
};

// ===========================================
// EVENT LISTENERS & INITIALIZATION
// ===========================================

// Global event listeners
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', cleanup);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                window.ConfigManager.saveConfig(app);
                window.Utils.showNotification('Konfiguration gespeichert', 'success');
                break;
            case 'a':
                if (e.shiftKey) {
                    e.preventDefault();
                    window.AudioMixer.addChannel(app);
                }
                break;
            case 'h':
                if (e.shiftKey) {
                    e.preventDefault();
                    window.HotkeyManager.addHotkey(app);
                }
                break;
        }
    }
});

// Platform specific adjustments
if (window.electronAPI && window.electronAPI.platform === 'win32') {
    document.body.classList.add('platform-win32');
    const windowControls = document.getElementById('windowControls');
    if (windowControls) {
        windowControls.style.display = 'flex';
    }
}

console.log('🎵 Renderer.js loaded, APP_STATE initialized');