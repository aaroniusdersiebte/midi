// native/audio-api.js
// JavaScript wrapper for the native audio controller module

let audioController = null;

// Try to load the native module
try {
    const native = require('../build/Release/audio_controller.node');
    audioController = new native.AudioController();
} catch (error) {
    console.warn('Native audio module not available, falling back to mock implementation');
    
    // Mock implementation for development/non-Windows platforms
    audioController = {
        getAudioSessions: () => {
            return [
                { id: 1, name: 'Spotify.exe', displayName: 'Spotify', volume: 70, muted: false },
                { id: 2, name: 'Discord.exe', displayName: 'Discord', volume: 50, muted: false },
                { id: 3, name: 'Chrome.exe', displayName: 'Chrome', volume: 80, muted: false },
                { id: 4, name: 'Game.exe', displayName: 'Game Audio', volume: 60, muted: false }
            ];
        },
        setApplicationVolume: (name, volume) => {
            console.log(`Mock: Setting ${name} volume to ${volume}%`);
            return true;
        },
        muteApplication: (name, mute) => {
            console.log(`Mock: ${mute ? 'Muting' : 'Unmuting'} ${name}`);
            return true;
        },
        getSystemVolume: () => 75,
        setSystemVolume: (volume) => {
            console.log(`Mock: Setting system volume to ${volume}%`);
            return true;
        }
    };
}

class AudioAPI {
    constructor() {
        this.controller = audioController;
        this.sessions = new Map();
        this.listeners = new Set();
        this.updateInterval = null;
    }

    // Start monitoring audio sessions
    startMonitoring(intervalMs = 1000) {
        if (this.updateInterval) return;
        
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
    }

    // Update session list
    async updateSessions() {
        try {
            const sessions = this.controller.getAudioSessions();
            const currentSessions = new Map();
            
            sessions.forEach(session => {
                const key = `${session.name}_${session.id}`;
                const existingSession = this.sessions.get(key);
                
                if (existingSession) {
                    // Check for changes
                    if (existingSession.volume !== session.volume || 
                        existingSession.muted !== session.muted) {
                        this.notifyListeners('volumeChanged', session);
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
            console.error('Failed to update audio sessions:', error);
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
            throw new Error(`Application not found: ${nameOrId}`);
        }
        
        const success = this.controller.setApplicationVolume(session.name, volume);
        if (success) {
            session.volume = volume;
            this.notifyListeners('volumeChanged', session);
        }
        
        return success;
    }

    // Mute/unmute application
    async setMute(nameOrId, mute) {
        let session;
        if (typeof nameOrId === 'string') {
            session = this.getSessionByName(nameOrId);
        } else {
            session = Array.from(this.sessions.values()).find(s => s.id === nameOrId);
        }
        
        if (!session) {
            throw new Error(`Application not found: ${nameOrId}`);
        }
        
        const success = this.controller.muteApplication(session.name, mute);
        if (success) {
            session.muted = mute;
            this.notifyListeners('muteChanged', session);
        }
        
        return success;
    }

    // Toggle mute
    async toggleMute(nameOrId) {
        const session = typeof nameOrId === 'string' 
            ? this.getSessionByName(nameOrId)
            : Array.from(this.sessions.values()).find(s => s.id === nameOrId);
            
        if (!session) {
            throw new Error(`Application not found: ${nameOrId}`);
        }
        
        return this.setMute(nameOrId, !session.muted);
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
                listener.callback(data);
            }
        });
    }

    // Create audio routing matrix
    async createRoutingMatrix(outputs) {
        const matrix = {
            inputs: this.getSessions(),
            outputs: outputs,
            routes: new Map()
        };
        
        // Initialize routes
        matrix.inputs.forEach(input => {
            matrix.outputs.forEach(output => {
                const key = `${input.id}_${output.id}`;
                matrix.routes.set(key, {
                    input: input.id,
                    output: output.id,
                    volume: 0,
                    enabled: false
                });
            });
        });
        
        return matrix;
    }

    // Route audio from input to output
    async routeAudio(inputId, outputId, volume = 100, enabled = true) {
        // This would integrate with virtual audio cable API
        console.log(`Routing audio: ${inputId} -> ${outputId} at ${volume}% (${enabled ? 'enabled' : 'disabled'})`);
        
        // In real implementation, this would:
        // 1. Create virtual audio device if needed
        // 2. Set up audio routing using Windows Core Audio APIs
        // 3. Apply volume/mixing settings
        
        return true;
    }
}

// Export singleton instance
module.exports = new AudioAPI();