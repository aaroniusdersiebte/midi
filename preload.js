const { contextBridge, ipcRenderer } = require('electron');

// Make OBS WebSocket available to renderer
try {
    const OBSWebSocket = require('obs-websocket-js').default;
    contextBridge.exposeInMainWorld('OBSWebSocket', OBSWebSocket);
} catch (error) {
    console.warn('OBS WebSocket not available:', error);
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
    
    // Window Controls (Windows only)
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Platform Info
    platform: process.platform
});