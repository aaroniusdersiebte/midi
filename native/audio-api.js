// native/audio-api.js
// Enhanced Mock Audio API with realistic VU meters and Windows app simulation

let audioController = null;
let isNativeAvailable = false;

// Try to load the native module
try {
    const native = require('../build/Release/audio_controller.node');
    if (native && native.AudioController) {
        audioController = new native.AudioController();
        isNativeAvailable = true;
        console.log('✅ Native audio controller loaded successfully');
    } else {
        throw new Error('AudioController class not found in native module');
    }
} catch (error) {
    console.warn('⚠️  Native audio module not available:', error.message);
    console.warn('📝 Using enhanced mock implementation with realistic VU meters');
    
    // Create enhanced mock controller
    audioController = createRealisticMockController();
    isNativeAvailable = false;
}

function createRealisticMockController() {
    const mockSessions = new Map();
    let sessionIdCounter = 1;
    
    // Realistic Windows applications with detailed audio profiles
    const windowsApps = [
        { 
            name: 'Spotify.exe', 
            displayName: 'Spotify', 
            baseVolume: 75, 
            activityPattern: 'music',
            color: '#1DB954'
        },
        { 
            name: 'Discord.exe', 
            displayName: 'Discord', 
            baseVolume: 60, 
            activityPattern: 'voice',
            color: '#5865F2'
        },
        { 
            name: 'chrome.exe', 
            displayName: 'Google Chrome', 
            baseVolume: 80, 
            activityPattern: 'web',
            color: '#4285F4'
        },
        { 
            name: 'firefox.exe', 
            displayName: 'Firefox', 
            baseVolume: 70, 
            activityPattern: 'web',
            color: '#FF7139'
        },
        { 
            name: 'vlc.exe', 
            displayName: 'VLC Media Player', 
            baseVolume: 85, 
            activityPattern: 'video',
            color: '#FF8C00'
        },
        { 
            name: 'obs64.exe', 
            displayName: 'OBS Studio', 
            baseVolume: 50, 
            activityPattern: 'streaming',
            color: '#302E31'
        },
        { 
            name: 'steam.exe', 
            displayName: 'Steam', 
            baseVolume: 40, 
            activityPattern: 'gaming',
            color: '#1B2838'
        },
        { 
            name: 'Teams.exe', 
            displayName: 'Microsoft Teams', 
            baseVolume: 65, 
            activityPattern: 'voice',
            color: '#6264A7'
        },
        { 
            name: 'Zoom.exe', 
            displayName: 'Zoom', 
            baseVolume: 70, 
            activityPattern: 'voice',
            color: '#2D8CFF'
        },
        { 
            name: 'notepad.exe', 
            displayName: 'Windows Sounds', 
            baseVolume: 30, 
            activityPattern: 'system',
            color: '#0078D4'
        }
    ];
    
    // Initialize realistic sessions
    const numActiveSessions = Math.floor(Math.random() * 4) + 4; // 4-7 active apps
    const shuffledApps = windowsApps.sort(() => 0.5 - Math.random()).slice(0, numActiveSessions);
    
    shuffledApps.forEach(app => {
        const sessionId = sessionIdCounter++;
        mockSessions.set(sessionId, {
            id: sessionId,
            name: app.name,
            displayName: app.displayName,
            volume: app.baseVolume + Math.floor(Math.random() * 20 - 10), // ±10 variation
            muted: Math.random() > 0.85, // 15% chance of being muted
            level: 0,
            peakLevel: 0,
            activityPattern: app.activityPattern,
            color: app.color,
            lastActivity: Date.now() - Math.random() * 5000,
            activityCycle: Math.random() * Math.PI * 2, // For wave patterns
            baseActivity: Math.random() * 0.6 + 0.2 // 0.2-0.8 base activity
        });
    });
    
    // Audio pattern generators
    const audioPatterns = {
        music: (session, time) => {
            const beat = Math.sin(time / 500) * 0.3; // Beat pattern
            const bass = Math.sin(time / 200) * 0.2; // Bass line
            const melody = Math.sin(time / 300 + session.activityCycle) * 0.4; // Melody
            return Math.abs(beat + bass + melody) * session.baseActivity;
        },
        
        voice: (session, time) => {
            const speech = Math.random() > 0.7 ? Math.random() * 0.8 : 0.1; // Speech bursts
            const background = Math.sin(time / 1000) * 0.1; // Background noise
            return (speech + background) * session.baseActivity;
        },
        
        web: (session, time) => {
            const notification = Math.random() > 0.98 ? Math.random() * 0.6 : 0; // Occasional sounds
            const video = Math.sin(time / 400 + session.activityCycle) * 0.3; // Video content
            return (notification + Math.abs(video)) * session.baseActivity * 0.7;
        },
        
        video: (session, time) => {
            const audio = Math.sin(time / 300) * 0.6; // Video audio
            const effects = Math.random() > 0.9 ? Math.random() * 0.4 : 0; // Sound effects
            return (Math.abs(audio) + effects) * session.baseActivity;
        },
        
        gaming: (session, time) => {
            const action = Math.random() > 0.8 ? Math.random() * 0.9 : 0.2; // Action sounds
            const ambient = Math.sin(time / 600 + session.activityCycle) * 0.3; // Ambient
            return (action + Math.abs(ambient)) * session.baseActivity;
        },
        
        streaming: (session, time) => {
            const input = Math.sin(time / 800) * 0.4; // Input monitoring
            const alerts = Math.random() > 0.95 ? Math.random() * 0.7 : 0; // Stream alerts
            return (Math.abs(input) + alerts) * session.baseActivity * 0.8;
        },
        
        system: (session, time) => {
            const notification = Math.random() > 0.99 ? Math.random() * 0.5 : 0;
            return notification * 0.3;
        }
    };
    
    return {
        getAudioSessions: () => {
            const currentTime = Date.now();
            const sessions = [];
            
            mockSessions.forEach(session => {
                // Generate realistic audio levels based on activity pattern
                let currentLevel = 0;
                let peakLevel = session.peakLevel || 0;
                
                if (!session.muted) {
                    const pattern = audioPatterns[session.activityPattern] || audioPatterns.web;
                    const rawLevel = pattern(session, currentTime);
                    
                    // Apply volume scaling
                    currentLevel = Math.min(1.0, rawLevel * (session.volume / 100));
                    
                    // Peak detection with decay
                    if (currentLevel > peakLevel) {
                        peakLevel = currentLevel;
                    } else {
                        peakLevel = Math.max(0, peakLevel - 0.02); // Peak decay
                    }
                    
                    session.peakLevel = peakLevel;
                }
                
                session.level = currentLevel;
                
                sessions.push({
                    id: session.id,
                    name: session.name,
                    displayName: session.displayName,
                    volume: Math.max(0, Math.min(100, session.volume)),
                    muted: session.muted,
                    level: currentLevel,
                    peakLevel: peakLevel,
                    color: session.color,
                    isActive: true
                });
            });
            
            return sessions;
        },
        
        setApplicationVolume: (name, volume) => {
            console.log(`🔊 Mock: Setting ${name} volume to ${volume}%`);
            
            // Update mock session volume
            mockSessions.forEach(session => {
                if (session.name.toLowerCase().includes(name.toLowerCase()) ||
                    session.displayName.toLowerCase().includes(name.toLowerCase())) {
                    session.volume = Math.max(0, Math.min(100, volume));
                    
                    // Trigger activity to show immediate response
                    session.lastActivity = Date.now();
                }
            });
            
            return true;
        },
        
        muteApplication: (name, mute) => {
            console.log(`🔇 Mock: ${mute ? 'Muting' : 'Unmuting'} ${name}`);
            
            // Update mock session mute state
            mockSessions.forEach(session => {
                if (session.name.toLowerCase().includes(name.toLowerCase()) ||
                    session.displayName.toLowerCase().includes(name.toLowerCase())) {
                    session.muted = mute;
                    
                    // Reset level when muting/unmuting
                    if (mute) {
                        session.level = 0;
                        session.peakLevel = 0;
                    } else {
                        session.lastActivity = Date.now();
                    }
                }
            });
            
            return true;
        },
        
        getSystemVolume: () => 75,
        
        setSystemVolume: (volume) => {
            console.log(`🔊 Mock: Setting system volume to ${volume}%`);
            return true;
        },
        
        // Mock system audio session
        getSystemSession: () => ({
            id: 'system',
            name: 'System Audio',
            displayName: 'Desktop Audio',
            volume: 75,
            muted: false,
            level: Math.sin(Date.now() / 1000) * 0.3 + 0.1, // Gentle system audio
            peakLevel: 0.4,
            color: '#0078D4',
            isActive: true
        }),
        
        // Mock microphone session
        getMicrophoneSession: () => ({
            id: 'microphone',
            name: 'Microphone',
            displayName: 'Default Microphone',
            volume: 60,
            muted: false,
            level: Math.random() > 0.8 ? Math.random() * 0.6 : 0.05, // Occasional voice activity
            peakLevel: 0.3,
            color: '#FF4444',
            isActive: true
        })
    };
}

class AudioAPI {
    constructor() {
        this.controller = audioController;
        this.sessions = new Map();
        this.listeners = new Set();
        this.updateInterval = null;
        this.isNative = isNativeAvailable;
        
        console.log(`🎛️ AudioAPI initialized (${isNativeAvailable ? 'Native' : 'Enhanced Mock'} mode)`);
    }

    // Start monitoring audio sessions
    async startMonitoring(intervalMs = 100) {
        if (this.updateInterval) return;
        
        console.log(`🎵 Starting audio monitoring (${intervalMs}ms interval, ${this.isNative ? 'Native' : 'Mock'} mode)`);
        
        this.updateInterval = setInterval(() => {
            this.updateSessions();
        }, intervalMs);
        
        // Initial update
        this.updateSessions();
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('🎵 Audio monitoring stopped');
    }

    // Update session list
    async updateSessions() {
        try {
            const appSessions = this.controller.getAudioSessions();
            const currentSessions = new Map();
            
            // Add system audio sessions
            if (!this.isNative) {
                const systemSession = this.controller.getSystemSession();
                const micSession = this.controller.getMicrophoneSession();
                
                currentSessions.set('system', systemSession);
                currentSessions.set('microphone', micSession);
            }
            
            // Add application sessions
            appSessions.forEach(session => {
                const key = `app_${session.id}`;
                const existingSession = this.sessions.get(key);
                
                if (existingSession) {
                    // Check for changes
                    if (existingSession.volume !== session.volume || 
                        existingSession.muted !== session.muted ||
                        Math.abs(existingSession.level - session.level) > 0.01) {
                        this.notifyListeners('sessionChanged', session);
                    }
                } else {
                    // New session
                    this.notifyListeners('sessionAdded', session);
                }
                
                currentSessions.set(key, session);
            });
            
            // Check for removed sessions
            this.sessions.forEach((session, key) => {
                if (!currentSessions.has(key)) {
                    this.notifyListeners('sessionRemoved', session);
                }
            });
            
            this.sessions = currentSessions;
        } catch (error) {
            console.error('❌ Failed to update audio sessions:', error);
        }
    }

    // Get all audio sessions
    getSessions() {
        return Array.from(this.sessions.values());
    }

    // Get session by name
    getSessionByName(name) {
        for (const session of this.sessions.values()) {
            if (session.name.toLowerCase().includes(name.toLowerCase()) ||
                session.displayName.toLowerCase().includes(name.toLowerCase())) {
                return session;
            }
        }
        return null;
    }

    // Set application volume
    async setVolume(nameOrId, volume) {
        volume = Math.max(0, Math.min(100, Math.round(volume)));
        
        let session;
        if (typeof nameOrId === 'string') {
            session = this.getSessionByName(nameOrId);
        } else {
            session = Array.from(this.sessions.values()).find(s => s.id === nameOrId);
        }
        
        if (!session) {
            console.warn(`❌ Application not found: ${nameOrId}`);
            return false;
        }
        
        const success = this.controller.setApplicationVolume(session.name, volume);
        if (success) {
            session.volume = volume;
            this.notifyListeners('volumeChanged', session);
        }
        
        return success;
    }

    // Toggle mute
    async toggleMute(nameOrId) {
        const session = typeof nameOrId === 'string' 
            ? this.getSessionByName(nameOrId)
            : Array.from(this.sessions.values()).find(s => s.id === nameOrId);
            
        if (!session) {
            console.warn(`❌ Application not found: ${nameOrId}`);
            return false;
        }
        
        const success = this.controller.muteApplication(session.name, !session.muted);
        if (success) {
            session.muted = !session.muted;
            this.notifyListeners('muteChanged', session);
        }
        
        return success;
    }

    // Get system volume
    getSystemVolume() {
        return this.controller.getSystemVolume();
    }

    // Set system volume
    setSystemVolume(volume) {
        volume = Math.max(0, Math.min(100, Math.round(volume)));
        return this.controller.setSystemVolume(volume);
    }

    // Add event listener
    on(event, callback) {
        this.listeners.add({ event, callback });
    }

    // Remove event listener
    off(event, callback) {
        this.listeners.delete({ event, callback });
    }

    // Notify listeners
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error('❌ Error in event listener:', error);
                }
            }
        });
    }

    // Check if native audio is available
    isNativeAvailable() {
        return this.isNative;
    }

    // Get detailed status information
    getStatus() {
        return {
            isNative: this.isNative,
            sessionCount: this.sessions.size,
            monitoringActive: this.updateInterval !== null,
            mode: this.isNative ? 'Native Windows Audio' : 'Enhanced Mock Mode'
        };
    }
}

// Export singleton instance
module.exports = new AudioAPI();