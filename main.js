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
        dialog.showErrorBox('Missing Files', 'Some required files are missing. Please run: node fix.js');
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

    // Open dev tools to see errors
    mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.openDevTools();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // Window control handlers (Windows)
    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });
    
    ipcMain.on('maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    
    ipcMain.on('close-window', () => {
        mainWindow.close();
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

// Load native audio module
let audioAPI;
try {
    audioAPI = require('./native/audio-api');
    audioAPI.startMonitoring();
    console.log('Native audio module loaded successfully');
} catch (error) {
    console.warn('Native audio module not available, using fallback:', error.message);
    // Create stub for development
    audioAPI = {
        getSessions: () => [],
        setVolume: () => true,
        toggleMute: () => true,
        routeAudio: () => true,
        createRoutingMatrix: () => ({ inputs: [], outputs: [], routes: new Map() })
    };
}

// IPC Handlers
ipcMain.handle('get-audio-sources', async () => {
    if (audioAPI) {
        // Get real audio sessions from Windows
        const sessions = audioAPI.getSessions();
        
        // Add system sources
        const sources = [
            { id: 'system', name: 'System Audio', type: 'system' },
            { id: 'microphone', name: 'Mikrofon', type: 'input' }
        ];
        
        // Add application sources
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
        // Fallback for demo
        return [
            { id: 'system', name: 'System Audio', type: 'system' },
            { id: 'microphone', name: 'Mikrofon', type: 'input' },
            { id: 'app_spotify', name: 'Spotify', type: 'application' },
            { id: 'app_discord', name: 'Discord', type: 'application' },
            { id: 'app_chrome', name: 'Chrome', type: 'application' }
        ];
    }
});

ipcMain.handle('save-config', async (event, config) => {
    store.set('config', config);
    return true;
});

ipcMain.handle('load-config', async () => {
    return store.get('config', {
        audioChannels: [],
        hotkeys: [],
        settings: {}
    });
});

ipcMain.handle('select-audio-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac'] }
        ]
    });
    
    if (!result.canceled) {
        return result.filePaths[0];
    }
    return null;
});

// Virtual Audio Cable Integration
// Für Windows würde hier VB-Cable oder Virtual Audio Cable verwendet
ipcMain.handle('create-virtual-output', async (event, name) => {
    // Implementation würde Virtual Audio Device erstellen
    console.log('Creating virtual output:', name);
    return { success: true, deviceId: `virtual_${Date.now()}` };
});

// Set application volume
ipcMain.handle('set-app-volume', async (event, appId, volume) => {
    if (!audioAPI) return false;
    
    try {
        // Extract process name from appId (e.g., "app_spotify" -> "spotify")
        const processName = appId.replace('app_', '');
        return await audioAPI.setVolume(processName, volume);
    } catch (error) {
        console.error('Failed to set volume:', error);
        return false;
    }
});

// Mute/unmute application
ipcMain.handle('toggle-app-mute', async (event, appId) => {
    if (!audioAPI) return false;
    
    try {
        const processName = appId.replace('app_', '');
        return await audioAPI.toggleMute(processName);
    } catch (error) {
        console.error('Failed to toggle mute:', error);
        return false;
    }
});

// Audio routing with virtual cable
ipcMain.handle('route-audio', async (event, sourceId, targetId, volume) => {
    if (!audioAPI) {
        console.log(`Mock routing: ${sourceId} to ${targetId} at ${volume}%`);
        return true;
    }
    
    try {
        return await audioAPI.routeAudio(sourceId, targetId, volume);
    } catch (error) {
        console.error('Failed to route audio:', error);
        return false;
    }
});

// Get routing matrix
ipcMain.handle('get-routing-matrix', async () => {
    if (!audioAPI) return null;
    
    const outputs = [
        { id: 'obs_mix', name: 'OBS Mix' },
        { id: 'stream_mix', name: 'Stream Mix' },
        { id: 'recording_mix', name: 'Recording Mix' }
    ];
    
    return await audioAPI.createRoutingMatrix(outputs);
});

// Monitor audio levels
let levelMonitorInterval = null;
ipcMain.handle('start-level-monitor', async () => {
    if (levelMonitorInterval) return;
    
    levelMonitorInterval = setInterval(() => {
        mainWindow?.webContents.send('audio-levels', {
            // In real implementation, would get actual audio levels
            levels: audioAPI ? audioAPI.getSessions().map(s => ({
                id: s.id,
                level: Math.random() * s.volume / 100
            })) : []
        });
    }, 50);
});

ipcMain.handle('stop-level-monitor', async () => {
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
        levelMonitorInterval = null;
    }
});

// Clean up on app quit
app.on('before-quit', () => {
    if (audioAPI) {
        audioAPI.stopMonitoring();
    }
    if (levelMonitorInterval) {
        clearInterval(levelMonitorInterval);
    }
});