const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');

// Configuration store
const store = new Store();

let mainWindow;
let audioAPI = null;
let isNativeAudioAvailable = false;
let appStatus = { mode: 'unknown' };

// Load build status if available
try {
    if (fs.existsSync('build-status.json')) {
        appStatus = JSON.parse(fs.readFileSync('build-status.json', 'utf8'));
        console.log(`📋 Build Status: ${appStatus.mode} mode`);
    }
} catch (error) {
    console.warn('⚠️  Could not load build status');
}

// Check required files
const checkFiles = () => {
    const requiredFiles = [
        'renderer/index.html',
        'renderer/styles.css',
        'renderer/renderer.js'
    ];
    
    const missing = requiredFiles.filter(file => 
        !fs.existsSync(path.join(__dirname, file))
    );
    
    if (missing.length > 0) {
        console.error('❌ Missing files:', missing);
        return false;
    }
    
    console.log('✅ All required files found');
    return true;
};

function createWindow() {
    if (!checkFiles()) {
        dialog.showErrorBox(
            'Missing Files', 
            'Required files are missing. Please check installation or run: node build-fix.js'
        );
        app.quit();
        return;
    }
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#1a1918',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        frame: process.platform !== 'win32',
        icon: path.join(__dirname, 'assets/icons/icon.png')
    });

    // Load the app
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Development tools
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Window event handlers
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // Window controls for Windows
    if (process.platform === 'win32') {
        setupWindowControls();
    }
    
    // Send initial status
    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            if (mainWindow) {
                mainWindow.webContents.send('audio-status-update', {
                    isNativeAvailable: isNativeAudioAvailable,
                    mode: appStatus.mode,
                    message: getStatusMessage()
                });
            }
        }, 1000);
    });
}

function getStatusMessage() {
    if (isNativeAudioAvailable) {
        return '🎉 Native Windows Audio Control Active - Real app control enabled!';
    } else if (appStatus.mode === 'mock') {
        return '🎨 Enhanced Mock Mode - Realistic VU meters and full UI functionality';
    } else {
        return '⚠️  Limited mode - run "node build-fix.js" for full functionality';
    }
}

function setupWindowControls() {
    ipcMain.on('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });
    
    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });
    
    ipcMain.on('close-window', () => {
        if (mainWindow) mainWindow.close();
    });
}

// Initialize audio module with enhanced error handling
async function initializeAudioModule() {
    console.log('🎵 Initializing audio module...');
    
    try {
        // Load the audio API (will automatically fallback to mock if native fails)
        audioAPI = require('./native/audio-api');
        
        if (audioAPI.isNativeAvailable()) {
            isNativeAudioAvailable = true;
            console.log('✅ Native audio module loaded successfully');
            console.log('🎛️ Real Windows audio control enabled');
        } else {
            isNativeAudioAvailable = false;
            console.log('✅ Enhanced mock audio module loaded');
            console.log('🎨 Realistic VU meters and app simulation enabled');
        }
        
        // Start monitoring
        if (audioAPI.startMonitoring) {
            await audioAPI.startMonitoring(isNativeAudioAvailable ? 100 : 150);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to initialize audio module:', error);
        
        // Create minimal fallback
        audioAPI = createMinimalFallback();
        isNativeAudioAvailable = false;
        
        return false;
    }
}

// Minimal fallback for worst-case scenarios
function createMinimalFallback() {
    console.log('📝 Creating minimal fallback audio API');
    
    return {
        getSessions: () => [
            { id: 1, name: 'System Audio', displayName: 'System Audio', volume: 75, muted: false, level: 0 },
            { id: 2, name: 'Microphone', displayName: 'Microphone', volume: 60, muted: false, level: 0 }
        ],
        setVolume: async () => true,
        toggleMute: async () => true,
        startMonitoring: async () => console.log('📝 Minimal monitoring started'),
        stopMonitoring: () => console.log('📝 Minimal monitoring stopped'),
        isNativeAvailable: () => false,
        getStatus: () => ({ isNative: false, mode: 'fallback' })
    };
}

// Enhanced IPC Handlers
ipcMain.handle('get-audio-sources', async () => {
    try {
        if (!audioAPI) {
            console.warn('⚠️  Audio API not initialized');
            return [];
        }
        
        const sessions = audioAPI.getSessions();
        const sources = [];
        
        // Add system sources
        sources.push({
            id: 'system',
            name: isNativeAudioAvailable ? 'System Audio' : '🎨 Desktop Audio (Enhanced Mock)',
            type: 'system',
            volume: 75,
            muted: false,
            level: Math.random() * 0.3
        });
        
        sources.push({
            id: 'microphone',
            name: isNativeAudioAvailable ? 'Default Microphone' : '🎤 Microphone (Enhanced Mock)',
            type: 'input',
            volume: 60,
            muted: false,
            level: Math.random() * 0.2
        });
        
        // Add application sessions
        sessions.forEach(session => {
            sources.push({
                id: `app_${session.id}`,
                name: isNativeAudioAvailable ? session.displayName : `🎨 ${session.displayName} (Mock)`,
                type: 'application',
                processName: session.name,
                volume: session.volume,
                muted: session.muted,
                level: session.level || 0,
                peakLevel: session.peakLevel || 0,
                color: session.color || '#0078D4'
            });
        });
        
        console.log(`📊 Found ${sources.length} audio sources (${isNativeAudioAvailable ? 'Native' : 'Mock'} mode)`);
        return sources;
        
    } catch (error) {
        console.error('❌ Error getting audio sources:', error);
        return [];
    }
});

ipcMain.handle('set-app-volume', async (event, appId, volume) => {
    if (!audioAPI) return false;
    
    try {
        let targetName = appId;
        
        if (appId.startsWith('app_')) {
            const sessions = audioAPI.getSessions();
            const sessionId = parseInt(appId.replace('app_', ''));
            const session = sessions.find(s => s.id === sessionId);
            targetName = session ? session.name : appId;
        }
        
        const success = await audioAPI.setVolume(targetName, volume);
        
        // Send feedback to renderer
        if (mainWindow) {
            mainWindow.webContents.send('volume-changed', {
                appId: appId,
                volume: volume,
                success: success,
                mode: isNativeAudioAvailable ? 'native' : 'mock'
            });
        }
        
        console.log(`🎚️ Volume set: ${targetName} -> ${volume}% (${success ? 'success' : 'failed'})`);
        return success;
        
    } catch (error) {
        console.error('❌ Failed to set volume:', error);
        return false;
    }
});

ipcMain.handle('toggle-app-mute', async (event, appId) => {
    if (!audioAPI) return false;
    
    try {
        let targetName = appId;
        
        if (appId.startsWith('app_')) {
            const sessions = audioAPI.getSessions();
            const sessionId = parseInt(appId.replace('app_', ''));
            const session = sessions.find(s => s.id === sessionId);
            targetName = session ? session.name : appId;
        }
        
        const success = await audioAPI.toggleMute(targetName);
        
        // Send feedback to renderer
        if (mainWindow) {
            mainWindow.webContents.send('mute-toggled', {
                appId: appId,
                success: success,
                mode: isNativeAudioAvailable ? 'native' : 'mock'
            });
        }
        
        console.log(`🔇 Mute toggled: ${targetName} (${success ? 'success' : 'failed'})`);
        return success;
        
    } catch (error) {
        console.error('❌ Failed to toggle mute:', error);
        return false;
    }
});

// Configuration handlers
ipcMain.handle('save-config', async (event, config) => {
    try {
        store.set('config', config);
        console.log('💾 Configuration saved');
        return true;
    } catch (error) {
        console.error('❌ Failed to save config:', error);
        return false;
    }
});

ipcMain.handle('load-config', async () => {
    try {
        const config = store.get('config', {
            audioChannels: [],
            hotkeys: [],
            settings: {}
        });
        console.log('📋 Configuration loaded');
        return config;
    } catch (error) {
        console.error('❌ Failed to load config:', error);
        return { audioChannels: [], hotkeys: [], settings: {} };
    }
});

// File selection
ipcMain.handle('select-audio-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'] }
            ]
        });
        
        return result.canceled ? null : result.filePaths[0];
    } catch (error) {
        console.error('❌ Failed to select audio file:', error);
        return null;
    }
});

// Virtual Audio Output
ipcMain.handle('create-virtual-output', async (event, name) => {
    try {
        console.log(`🔌 Creating virtual output: ${name}`);
        
        const virtualOutput = {
            id: `virtual_${Date.now()}`,
            name: name,
            deviceId: `virtual_device_${Math.random().toString(36).substr(2, 9)}`,
            created: new Date().toISOString(),
            mode: isNativeAudioAvailable ? 'native' : 'mock'
        };
        
        console.log(`✅ Virtual output created: ${virtualOutput.id}`);
        return { success: true, ...virtualOutput };
        
    } catch (error) {
        console.error('❌ Failed to create virtual output:', error);
        return { success: false, error: error.message };
    }
});

// Audio Routing
ipcMain.handle('route-audio', async (event, sourceId, targetId, volume) => {
    try {
        console.log(`🔀 Routing audio: ${sourceId} -> ${targetId} at ${volume}%`);
        
        if (mainWindow) {
            mainWindow.webContents.send('audio-routed', {
                source: sourceId,
                target: targetId,
                volume: volume,
                mode: isNativeAudioAvailable ? 'native' : 'mock'
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to route audio:', error);
        return false;
    }
});

// Routing Matrix
ipcMain.handle('get-routing-matrix', async () => {
    try {
        const outputs = [
            { id: 'obs_mix', name: 'OBS Mix' },
            { id: 'stream_mix', name: 'Stream Mix' },
            { id: 'recording_mix', name: 'Recording Mix' }
        ];
        
        const inputs = audioAPI ? audioAPI.getSessions() : [];
        
        return {
            inputs: inputs,
            outputs: outputs,
            routes: new Map(),
            mode: isNativeAudioAvailable ? 'native' : 'mock'
        };
    } catch (error) {
        console.error('❌ Failed to get routing matrix:', error);
        return null;
    }
});

// Audio status information
ipcMain.handle('get-audio-status', async () => {
    return {
        isNativeAvailable: isNativeAudioAvailable,
        mockMode: !isNativeAudioAvailable,
        platform: process.platform,
        buildPath: path.join(__dirname, 'build', 'Release', 'audio_controller.node'),
        buildExists: fs.existsSync(path.join(__dirname, 'build', 'Release', 'audio_controller.node')),
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        sessionCount: audioAPI ? audioAPI.getSessions().length : 0,
        mode: appStatus.mode,
        message: getStatusMessage()
    };
});

// Enhanced level monitoring
let levelMonitorInterval = null;

ipcMain.handle('start-level-monitor', async () => {
    if (levelMonitorInterval) return;
    
    console.log(`🎵 Starting audio level monitoring (${isNativeAudioAvailable ? 'Native' : 'Enhanced Mock'})`);
    
    levelMonitorInterval = setInterval(() => {
        if (!mainWindow || !audioAPI) return;
        
        try {
            const sessions = audioAPI.getSessions();
            const levels = sessions.map(session => ({
                id: session.id,
                level: session.level || 0,
                peakLevel: session.peakLevel || 0,
                color: session.color || '#0078D4',
                isNative: isNativeAudioAvailable
            }));
            
            mainWindow.webContents.send('audio-levels', {
                levels: levels,
                isNativeAudio: isNativeAudioAvailable,
                timestamp: Date.now(),
                mode: appStatus.mode
            });
        } catch (error) {
            console.error('❌ Error in level monitor:', error);
        }
    }, isNativeAudioAvailable ? 50 : 100);
});

ipcMain.handle('stop-level-monitor', async () => {
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
        levelMonitorInterval = null;
        console.log('🎵 Audio level monitoring stopped');
    }
});

// App lifecycle
app.whenReady().then(async () => {
    console.log('🚀 App ready, initializing...');
    
    await initializeAudioModule();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    console.log('🧹 Cleaning up...');
    
    if (audioAPI && audioAPI.stopMonitoring) {
        audioAPI.stopMonitoring();
    }
    
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
    }
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', promise, 'reason:', reason);
});