const { contextBridge, ipcRenderer } = require('electron');

// Safely expose OBS WebSocket
let OBSWebSocketModule;
try {
    OBSWebSocketModule = require('obs-websocket-js');
    console.log('OBS WebSocket module loaded successfully');
} catch (error) {
    console.warn('OBS WebSocket not available:', error.message);
    // Create a dummy class for fallback
    OBSWebSocketModule = {
        default: class {
            constructor() {
                this.connected = false;
            }
            async connect() {
                throw new Error('OBS WebSocket not available');
            }
            async disconnect() {}
            async call() {
                throw new Error('OBS WebSocket not available');
            }
        }
    };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Audio Sources
    getAudioSources: () => ipcRenderer.invoke('get-audio-sources'),
    
    // Application Volume Control
    setAppVolume: (appId, volume) => ipcRenderer.invoke('set-app-volume', appId, volume),
    toggleAppMute: (appId) => ipcRenderer.invoke('toggle-app-mute', appId),
    
    // Configuration
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),
    
    // File Selection
    selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
    
    // Virtual Audio
    createVirtualOutput: (name) => ipcRenderer.invoke('create-virtual-output', name),
    routeAudio: (sourceId, targetId, volume) => 
        ipcRenderer.invoke('route-audio', sourceId, targetId, volume),
    getRoutingMatrix: () => ipcRenderer.invoke('get-routing-matrix'),
    
    // Audio Level Monitoring
    startLevelMonitor: () => ipcRenderer.invoke('start-level-monitor'),
    stopLevelMonitor: () => ipcRenderer.invoke('stop-level-monitor'),
    onAudioLevels: (callback) => {
        ipcRenderer.on('audio-levels', (event, data) => callback(data));
    },
    removeAudioLevelsListener: () => {
        ipcRenderer.removeAllListeners('audio-levels');
    },
    
    // Window Controls (Windows only)
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Platform Info
    platform: process.platform,
    
    // OBS WebSocket - exposed safely
    createOBSWebSocket: () => {
        return new OBSWebSocketModule.default();
    }
});

// Alternative: Expose OBS WebSocket class directly if context isolation is disabled
if (!process.contextIsolated) {
    window.OBSWebSocket = OBSWebSocketModule.default;
    window.electronAPI = {
        getAudioSources: () => ipcRenderer.invoke('get-audio-sources'),
        setAppVolume: (appId, volume) => ipcRenderer.invoke('set-app-volume', appId, volume),
        toggleAppMute: (appId) => ipcRenderer.invoke('toggle-app-mute', appId),
        saveConfig: (config) => ipcRenderer.invoke('save-config', config),
        loadConfig: () => ipcRenderer.invoke('load-config'),
        selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
        createVirtualOutput: (name) => ipcRenderer.invoke('create-virtual-output', name),
        routeAudio: (sourceId, targetId, volume) => 
            ipcRenderer.invoke('route-audio', sourceId, targetId, volume),
        getRoutingMatrix: () => ipcRenderer.invoke('get-routing-matrix'),
        startLevelMonitor: () => ipcRenderer.invoke('start-level-monitor'),
        stopLevelMonitor: () => ipcRenderer.invoke('stop-level-monitor'),
        onAudioLevels: (callback) => {
            ipcRenderer.on('audio-levels', (event, data) => callback(data));
        },
        removeAudioLevelsListener: () => {
            ipcRenderer.removeAllListeners('audio-levels');
        },
        minimizeWindow: () => ipcRenderer.send('minimize-window'),
        maximizeWindow: () => ipcRenderer.send('maximize-window'),
        closeWindow: () => ipcRenderer.send('close-window'),
        platform: process.platform
    };
}