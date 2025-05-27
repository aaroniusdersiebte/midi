// renderer/modules/config-manager.js
// Configuration management for the MIDI Controller App

window.ConfigManager = (function() {
    
    let saveTimeout;
    
    // Initialize configuration manager
    async function init(app) {
        console.log('📋 Initializing Config Manager...');
        await loadConfig(app);
    }

    // Load configuration
    async function loadConfig(app) {
        try {
            const config = await window.electronAPI.loadConfig();
            
            // Load settings
            if (config.settings) {
                const { deviceId, obsWebsocket, obsPassword, virtualOutput } = config.settings;
                
                // Update UI elements
                updateUIElement('midiDeviceSelect', deviceId || '');
                updateUIElement('obsWebsocket', obsWebsocket || '');
                updateUIElement('obsPassword', obsPassword || '');
                updateUIElement('enableVirtualOutput', virtualOutput || false);
                
                // Connect MIDI device after a delay to ensure device list is populated
                if (deviceId) {
                    setTimeout(() => {
                        if (window.MIDIController) {
                            window.MIDIController.connectDevice(app, deviceId);
                        }
                    }, 1000);
                }
                
                // Connect to OBS
                if (obsWebsocket && window.OBSController) {
                    window.OBSController.connect(app, obsWebsocket, obsPassword);
                }
            }
            
            // Load audio channels and hotkeys
            app.audioChannels = config.audioChannels || [];
            app.hotkeys = config.hotkeys || [];
            
            // Render loaded data
            if (window.AudioMixer) {
                window.AudioMixer.renderChannels(app);
            }
            if (window.HotkeyManager) {
                window.HotkeyManager.renderHotkeys(app);
            }
            
            console.log('✅ Configuration loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            window.Utils.showNotification('Fehler beim Laden der Konfiguration', 'error');
            
            // Set defaults
            app.audioChannels = [];
            app.hotkeys = [];
        }
    }

    // Save configuration
    async function saveConfig(app) {
        try {
            const config = {
                audioChannels: app.audioChannels || [],
                hotkeys: app.hotkeys || [],
                settings: {
                    deviceId: getUIElementValue('midiDeviceSelect'),
                    obsWebsocket: getUIElementValue('obsWebsocket'),
                    obsPassword: getUIElementValue('obsPassword'),
                    virtualOutput: getUIElementValue('enableVirtualOutput'),
                    masterVolume: app.masterVolume || 70,
                    version: '1.0.0',
                    lastSaved: new Date().toISOString()
                }
            };
            
            await window.electronAPI.saveConfig(config);
            console.log('💾 Configuration saved');
            
        } catch (error) {
            console.error('❌ Failed to save configuration:', error);
            window.Utils.showNotification('Fehler beim Speichern der Konfiguration', 'error');
        }
    }

    // Debounced save for performance
    function saveConfigDebounced(app) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveConfig(app), 500);
    }

    // Export configuration
    async function exportConfig(app) {
        try {
            const config = {
                audioChannels: app.audioChannels,
                hotkeys: app.hotkeys,
                settings: {
                    version: '1.0.0',
                    exportedAt: new Date().toISOString()
                }
            };
            
            const dataStr = JSON.stringify(config, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `midi-controller-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            window.Utils.showNotification('Konfiguration exportiert', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            window.Utils.showNotification('Export fehlgeschlagen', 'error');
        }
    }

    // Import configuration
    async function importConfig(app, file) {
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            
            // Validate configuration
            if (!isValidConfig(config)) {
                throw new Error('Invalid configuration format');
            }
            
            // Ask for confirmation
            if (!confirm('Möchtest du die aktuelle Konfiguration ersetzen?')) {
                return;
            }
            
            // Apply configuration
            app.audioChannels = config.audioChannels || [];
            app.hotkeys = config.hotkeys || [];
            
            // Save and reload
            await saveConfig(app);
            await loadConfig(app);
            
            window.Utils.showNotification('Konfiguration importiert', 'success');
            
        } catch (error) {
            console.error('Import failed:', error);
            window.Utils.showNotification('Import fehlgeschlagen: ' + error.message, 'error');
        }
    }

    // Validate configuration format
    function isValidConfig(config) {
        if (!config || typeof config !== 'object') return false;
        
        // Check required fields
        const hasChannels = Array.isArray(config.audioChannels);
        const hasHotkeys = Array.isArray(config.hotkeys);
        
        return hasChannels && hasHotkeys;
    }

    // Reset configuration
    async function resetConfig(app) {
        if (!confirm('Möchtest du wirklich alle Einstellungen zurücksetzen?')) {
            return;
        }
        
        try {
            app.audioChannels = [];
            app.hotkeys = [];
            app.masterVolume = 70;
            app.masterPreviewing = false;
            
            await saveConfig(app);
            
            // Clear UI
            if (window.AudioMixer) {
                window.AudioMixer.renderChannels(app);
            }
            if (window.HotkeyManager) {
                window.HotkeyManager.renderHotkeys(app);
            }
            
            window.Utils.showNotification('Konfiguration zurückgesetzt', 'info');
            
        } catch (error) {
            console.error('Reset failed:', error);
            window.Utils.showNotification('Zurücksetzen fehlgeschlagen', 'error');
        }
    }

    // Helper functions
    function updateUIElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else {
                element.value = value || '';
            }
        }
    }

    function getUIElementValue(id) {
        const element = document.getElementById(id);
        if (element) {
            return element.type === 'checkbox' ? element.checked : element.value;
        }
        return null;
    }

    // Settings management
    async function openSettings(app) {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('active');
            
            // Update OBS scenes if connected
            if (window.OBSController && app.obsWebSocket && app.obsWebSocket.connected) {
                await window.OBSController.updateScenes(app);
            }
        }
    }

    async function saveSettings(app) {
        try {
            const deviceId = getUIElementValue('midiDeviceSelect');
            const obsWebsocket = getUIElementValue('obsWebsocket');
            const obsPassword = getUIElementValue('obsPassword');
            const enableVirtual = getUIElementValue('enableVirtualOutput');
            
            // Save configuration
            await saveConfig(app);
            
            // Apply settings
            if (window.MIDIController) {
                window.MIDIController.connectDevice(app, deviceId);
            }
            
            if (obsWebsocket && window.OBSController) {
                await window.OBSController.connect(app, obsWebsocket, obsPassword);
            }
            
            if (enableVirtual && !app.virtualCableOutput && window.AudioMixer) {
                await window.AudioMixer.initVirtualOutput(app);
            }
            
            window.Utils.closeModal('settingsModal');
            window.Utils.showNotification('Einstellungen gespeichert', 'success');
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            window.Utils.showNotification('Fehler beim Speichern der Einstellungen', 'error');
        }
    }

    // Auto-save functionality
    function enableAutoSave(app, interval = 30000) {
        setInterval(() => {
            saveConfig(app);
        }, interval);
        console.log(`⏰ Auto-save enabled (every ${interval/1000}s)`);
    }

    // Backup functionality
    async function createBackup(app) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const config = {
                audioChannels: app.audioChannels,
                hotkeys: app.hotkeys,
                settings: {
                    masterVolume: app.masterVolume,
                    version: '1.0.0',
                    backupCreated: new Date().toISOString()
                }
            };
            
            // Save to local backup (if available)
            if (window.Utils.setLocalStorage) {
                window.Utils.setLocalStorage(`backup_${timestamp}`, config);
            }
            
            console.log(`💾 Backup created: backup_${timestamp}`);
            return `backup_${timestamp}`;
            
        } catch (error) {
            console.error('Backup creation failed:', error);
            return null;
        }
    }

    // Public API
    return {
        init,
        loadConfig,
        saveConfig,
        saveConfigDebounced,
        exportConfig,
        importConfig,
        resetConfig,
        openSettings,
        saveSettings,
        enableAutoSave,
        createBackup,
        isValidConfig
    };
})();