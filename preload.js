const { contextBridge, ipcRenderer } = require('electron');

// Safely expose OBS WebSocket with better error handling
let OBSWebSocketModule = null;
let obsAvailable = false;

try {
    // Try to require OBS WebSocket - with multiple fallback paths
    try {
        OBSWebSocketModule = require('obs-websocket-js');
        obsAvailable = true;
        console.log('✅ OBS WebSocket module loaded successfully');
    } catch (firstError) {
        // Try alternative import methods
        try {
            const OBSWebSocket = require('obs-websocket-js').default;
            OBSWebSocketModule = { default: OBSWebSocket };
            obsAvailable = true;
            console.log('✅ OBS WebSocket module loaded (alternative method)');
        } catch (secondError) {
            throw new Error('OBS WebSocket not available: ' + firstError.message);
        }
    }
} catch (error) {
    console.warn('⚠️  OBS WebSocket not available:', error.message);
    console.warn('💡 Install with: npm install obs-websocket-js@5.0.6');
    
    // Create enhanced dummy class for fallback
    OBSWebSocketModule = {
        default: class MockOBSWebSocket {
            constructor() {
                this.connected = false;
                this.identified = false;
                this.address = null;
                this.obsWebSocketVersion = null;
                this.rpcVersion = null;
            }
            
            async connect(url, password) {
                console.log('🔇 Mock OBS: Connection attempted to', url);
                throw new Error('OBS WebSocket library not installed. Run: npm install obs-websocket-js@5.0.6');
            }
            
            async disconnect() {
                console.log('🔇 Mock OBS: Disconnect attempted');
                this.connected = false;
                this.identified = false;
            }
            
            async call(request, data) {
                console.log('🔇 Mock OBS: Call attempted:', request, data);
                throw new Error('OBS WebSocket not available');
            }
            
            on(event, callback) {
                console.log('🔇 Mock OBS: Event listener registered:', event);
            }
            
            off(event, callback) {
                console.log('🔇 Mock OBS: Event listener removed:', event);
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
    
    // Audio Status
    getAudioStatus: () => ipcRenderer.invoke('get-audio-status'),
    onAudioStatusUpdate: (callback) => {
        ipcRenderer.on('audio-status-update', (event, data) => callback(data));
    },
    onMockActionPerformed: (callback) => {
        ipcRenderer.on('mock-action-performed', (event, data) => callback(data));
    },
    
    // Window Controls (Windows only)
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    
    // Platform Info
    platform: process.platform,
    
    // OBS WebSocket - exposed safely with availability check
    createOBSWebSocket: () => {
        if (!obsAvailable) {
            console.warn('⚠️  OBS WebSocket not available, returning mock');
        }
        
        return new (OBSWebSocketModule.default || OBSWebSocketModule)();
    },
    
    isOBSAvailable: () => obsAvailable
});

// Legacy support for non-context-isolated environments
if (!process.contextIsolated) {
    console.warn('⚠️  Context isolation disabled - using legacy mode');
    
    window.OBSWebSocket = OBSWebSocketModule.default || OBSWebSocketModule;
    window.electronAPI = {
        // All the same methods as above
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
        getAudioStatus: () => ipcRenderer.invoke('get-audio-status'),
        onAudioStatusUpdate: (callback) => {
            ipcRenderer.on('audio-status-update', (event, data) => callback(data));
        },
        onMockActionPerformed: (callback) => {
            ipcRenderer.on('mock-action-performed', (event, data) => callback(data));
        },
        minimizeWindow: () => ipcRenderer.send('minimize-window'),
        maximizeWindow: () => ipcRenderer.send('maximize-window'),
        closeWindow: () => ipcRenderer.send('close-window'),
        platform: process.platform,
        createOBSWebSocket: () => new (OBSWebSocketModule.default || OBSWebSocketModule)(),
        isOBSAvailable: () => obsAvailable
    };
}

// Debug info
console.log(`🔌 Preload initialized - OBS: ${obsAvailable ? 'Available' : 'Not Available'}`);
console.log(`🖥️  Platform: ${process.platform}`);
console.log(`🔒 Context Isolation: ${process.contextIsolated ? 'Enabled' : 'Disabled'}`);