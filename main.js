const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');

// Check if files exist
const checkFiles = () => {
    const requiredFiles = [
        'renderer/index.html',
        'renderer/styles.css',
        'renderer/renderer.js'
    ];
    
    let allFilesExist = true;
    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            console.error(`Missing file: ${file}`);
            allFilesExist = false;
        } else {
            console.log(`✓ Found: ${file}`);
        }
    });
    
    return allFilesExist;
};

// Konfiguration speichern
const store = new Store();

let mainWindow;
let audioSources = [];

function createWindow() {
    // Check files before creating window
    if (!checkFiles()) {
        dialog.showErrorBox('Missing Files', 'Some required files are missing. Please ensure all renderer files exist.');
        app.quit();
        return;
    }
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: '#1a1918',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hiddenInset',
        frame: process.platform !== 'win32',
        icon: path.join(__dirname, 'assets/icons/icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Open dev tools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.webContents.once('dom-ready', () => {
            mainWindow.webContents.openDevTools();
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // Window control handlers (Windows)
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

app.whenReady().then(() => {
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

// Improved audio module loading with better error handling
let audioAPI;
let isNativeAudioAvailable = false;

try {
    // Try to load the compiled native module
    const nativeModulePath = path.join(__dirname, 'build', 'Release', 'audio_controller.node');
    
    if (fs.existsSync(nativeModulePath)) {
        const nativeModule = require(nativeModulePath);
        if (nativeModule && nativeModule.AudioController) {
            audioAPI = require('./native/audio-api');
            audioAPI.startMonitoring();
            isNativeAudioAvailable = true;
            console.log('✅ Native audio module loaded successfully');
        } else {
            throw new Error('Native module loaded but AudioController class not found');
        }
    } else {
        throw new Error(`Native module not found at: ${nativeModulePath}`);
    }
} catch (error) {
    console.warn('⚠️  Native audio module not available:', error.message);
    console.warn('📝 Falling back to mock implementation');
    console.warn('💡 To enable real audio control:');
    console.warn('   1. Install Visual Studio Build Tools');
    console.warn('   2. Run: npm run setup');
    console.warn('   3. Run: npm run build-native');
    
    isNativeAudioAvailable = false;
    
    // Enhanced mock implementation for development
    audioAPI = {
        getSessions: () => {
            // More realistic mock data that changes over time
            const mockApps = [
                { name: 'Spotify.exe', displayName: 'Spotify', baseVolume: 70 },
                { name: 'Discord.exe', displayName: 'Discord', baseVolume: 50 },
                { name: 'Chrome.exe', displayName: 'Chrome', baseVolume: 80 },
                { name: 'Game.exe', displayName: 'Game Audio', baseVolume: 60 },
                { name: 'OBS64.exe', displayName: 'OBS Studio', baseVolume: 45 }
            ];
            
            return mockApps.map((app, index) => ({
                id: index + 1,
                name: app.name,
                displayName: app.displayName,
                volume: Math.max(0, Math.min(100, app.baseVolume + Math.floor(Math.random() * 20 - 10))),
                muted: Math.random() > 0.8
            }));
        },
        setVolume: (name, volume) => {
            console.log(`🔊 Mock: Setting ${name} volume to ${volume}%`);
            return Promise.resolve(true);
        },
        toggleMute: (name) => {
            console.log(`🔇 Mock: Toggling mute for ${name}`);
            return Promise.resolve(true);
        },
        createRoutingMatrix: (outputs) => {
            console.log(`🎚️  Mock: Creating routing matrix with ${outputs.length} outputs`);
            return Promise.resolve({
                inputs: audioAPI.getSessions(),
                outputs: outputs,
                routes: new Map()
            });
        },
        routeAudio: (inputId, outputId, volume) => {
            console.log(`🔀 Mock: Routing ${inputId} -> ${outputId} at ${volume}%`);
            return Promise.resolve(true);
        },
        startMonitoring: () => {
            console.log('🎵 Mock: Audio monitoring started');
        },
        stopMonitoring: () => {
            console.log('🎵 Mock: Audio monitoring stopped');
        }
    };
}

// Enhanced IPC Handlers with better error handling
ipcMain.handle('get-audio-sources', async () => {
    try {
        if (isNativeAudioAvailable && audioAPI) {
            const sessions = audioAPI.getSessions();
            
            const sources = [
                { id: 'system', name: 'System Audio', type: 'system', volume: 75, muted: false },
                { id: 'microphone', name: 'Mikrofon', type: 'input', volume: 60, muted: false }
            ];
            
            sessions.forEach(session => {
                sources.push({
                    id: `app_${session.id}`,
                    name: session.displayName || session.name,
                    type: 'application',
                    processName: session.name,
                    volume: session.volume,
                    muted: session.muted
                });
            });
            
            return sources;
        } else {
            // Mock data with indicator that it's not real
            return [
                { id: 'system', name: '🔇 System Audio (Mock)', type: 'system', volume: 75, muted: false },
                { id: 'microphone', name: '🔇 Mikrofon (Mock)', type: 'input', volume: 60, muted: false },
                { id: 'app_spotify', name: '🔇 Spotify (Mock)', type: 'application', volume: 70, muted: false },
                { id: 'app_discord', name: '🔇 Discord (Mock)', type: 'application', volume: 50, muted: false },
                { id: 'app_chrome', name: '🔇 Chrome (Mock)', type: 'application', volume: 80, muted: false }
            ];
        }
    } catch (error) {
        console.error('Error getting audio sources:', error);
        return [];
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        store.set('config', config);
        return true;
    } catch (error) {
        console.error('Failed to save config:', error);
        return false;
    }
});

ipcMain.handle('load-config', async () => {
    try {
        return store.get('config', {
            audioChannels: [],
            hotkeys: [],
            settings: {}
        });
    } catch (error) {
        console.error('Failed to load config:', error);
        return {
            audioChannels: [],
            hotkeys: [],
            settings: {}
        };
    }
});

ipcMain.handle('select-audio-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    } catch (error) {
        console.error('Failed to select audio file:', error);
        return null;
    }
});

// Virtual Audio Cable Integration
ipcMain.handle('create-virtual-output', async (event, name) => {
    try {
        console.log('Creating virtual output:', name);
        return { success: true, deviceId: `virtual_${Date.now()}` };
    } catch (error) {
        console.error('Failed to create virtual output:', error);
        return { success: false, error: error.message };
    }
});

// Set application volume with real/mock indication
ipcMain.handle('set-app-volume', async (event, appId, volume) => {
    if (!audioAPI) return false;
    
    try {
        const processName = appId.replace('app_', '');
        const result = await audioAPI.setVolume(processName, volume);
        
        if (!isNativeAudioAvailable) {
            // Send notification to renderer that this is mock
            mainWindow?.webContents.send('mock-action-performed', {
                action: 'volume-change',
                app: processName,
                volume: volume
            });
        }
        
        return result;
    } catch (error) {
        console.error('Failed to set volume:', error);
        return false;
    }
});

// Mute/unmute application with real/mock indication
ipcMain.handle('toggle-app-mute', async (event, appId) => {
    if (!audioAPI) return false;
    
    try {
        const processName = appId.replace('app_', '');
        const result = await audioAPI.toggleMute(processName);
        
        if (!isNativeAudioAvailable) {
            mainWindow?.webContents.send('mock-action-performed', {
                action: 'mute-toggle',
                app: processName
            });
        }
        
        return result;
    } catch (error) {
        console.error('Failed to toggle mute:', error);
        return false;
    }
});

// Enhanced audio routing
ipcMain.handle('route-audio', async (event, sourceId, targetId, volume) => {
    if (!audioAPI) {
        console.log(`🔀 Mock routing: ${sourceId} to ${targetId} at ${volume}%`);
        return true;
    }
    
    try {
        const result = await audioAPI.routeAudio(sourceId, targetId, volume);
        
        if (!isNativeAudioAvailable) {
            mainWindow?.webContents.send('mock-action-performed', {
                action: 'audio-route',
                source: sourceId,
                target: targetId,
                volume: volume
            });
        }
        
        return result;
    } catch (error) {
        console.error('Failed to route audio:', error);
        return false;
    }
});

// Get routing matrix
ipcMain.handle('get-routing-matrix', async () => {
    if (!audioAPI) return null;
    
    try {
        const outputs = [
            { id: 'obs_mix', name: 'OBS Mix' },
            { id: 'stream_mix', name: 'Stream Mix' },
            { id: 'recording_mix', name: 'Recording Mix' }
        ];
        
        return await audioAPI.createRoutingMatrix(outputs);
    } catch (error) {
        console.error('Failed to get routing matrix:', error);
        return null;
    }
});

// Enhanced level monitoring with mock data indication
let levelMonitorInterval = null;
ipcMain.handle('start-level-monitor', async () => {
    if (levelMonitorInterval) return;
    
    console.log(`🎵 Starting audio level monitoring (${isNativeAudioAvailable ? 'Native' : 'Mock'} mode)`);
    
    levelMonitorInterval = setInterval(() => {
        if (!mainWindow || !audioAPI) return;
        
        try {
            const sessions = audioAPI.getSessions();
            
            const levels = sessions.map(session => ({
                id: session.id,
                level: isNativeAudioAvailable 
                    ? Math.random() * session.volume / 100  // Real audio levels would go here
                    : Math.random() * 0.8 * session.volume / 100,  // Mock with less aggressive levels
                isMock: !isNativeAudioAvailable
            }));
            
            mainWindow.webContents.send('audio-levels', {
                levels: levels,
                isNativeAudio: isNativeAudioAvailable,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error in level monitor:', error);
        }
    }, isNativeAudioAvailable ? 50 : 100); // Slower refresh for mock data
});

ipcMain.handle('stop-level-monitor', async () => {
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
        levelMonitorInterval = null;
        console.log('🎵 Audio level monitoring stopped');
    }
});

// Add handler to check native audio status
ipcMain.handle('get-audio-status', async () => {
    const buildPath = path.join(__dirname, 'build', 'Release', 'audio_controller.node');
    
    return {
        isNativeAvailable: isNativeAudioAvailable,
        mockMode: !isNativeAudioAvailable,
        platform: process.platform,
        buildPath: buildPath,
        buildExists: fs.existsSync(buildPath),
        nodeVersion: process.version,
        electronVersion: process.versions.electron
    };
});

// Clean up on app quit
app.on('before-quit', () => {
    console.log('🧹 Cleaning up before quit...');
    
    if (audioAPI && audioAPI.stopMonitoring) {
        audioAPI.stopMonitoring();
    }
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
    }
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Send audio status to renderer when ready
app.on('ready', () => {
    setTimeout(() => {
        if (mainWindow) {
            mainWindow.webContents.send('audio-status-update', {
                isNativeAvailable: isNativeAudioAvailable,
                message: isNativeAudioAvailable 
                    ? 'Native audio module loaded successfully' 
                    : 'Running in mock mode - run "npm run build-native" to enable real audio control'
            });
        }
    }, 2000);
});