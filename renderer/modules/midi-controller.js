// renderer/modules/midi-controller.js
// MIDI Controller functionality

window.MIDIController = (function() {
    
    // MIDI message smoothing
    const midiValues = {};
    const MIDI_SMOOTHING = 0.3;
    
    // Initialize MIDI controller
    async function init(app) {
        console.log('🎹 Initializing MIDI Controller...');
        
        try {
            app.midiAccess = await navigator.requestMIDIAccess();
            updateDeviceList(app);
            
            // Listen for MIDI device changes
            app.midiAccess.addEventListener('statechange', () => updateDeviceList(app));
            
            console.log('✅ MIDI Controller initialized');
            
        } catch (error) {
            console.error('❌ MIDI access failed:', error);
            window.Utils.showNotification('MIDI-Zugriff fehlgeschlagen', 'error');
        }
    }

    // Update MIDI device list
    function updateDeviceList(app) {
        const select = document.getElementById('midiDeviceSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Kein Gerät ausgewählt</option>';
        
        if (app.midiAccess) {
            for (const input of app.midiAccess.inputs.values()) {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name;
                select.appendChild(option);
            }
        }
    }

    // Connect MIDI device
    function connectDevice(app, deviceId) {
        // Disconnect current device
        if (app.midiInput) {
            app.midiInput.removeEventListener('midimessage', (event) => handleMIDIMessage(app, event));
        }
        
        if (deviceId && app.midiAccess) {
            app.midiInput = app.midiAccess.inputs.get(deviceId);
            if (app.midiInput) {
                app.midiInput.addEventListener('midimessage', (event) => handleMIDIMessage(app, event));
                
                // Update UI
                const deviceName = document.getElementById('deviceName');
                const statusIndicator = document.getElementById('statusIndicator');
                
                if (deviceName) deviceName.textContent = app.midiInput.name;
                if (statusIndicator) statusIndicator.classList.add('connected');
                
                window.Utils.showNotification(`${app.midiInput.name} verbunden`, 'success');
                console.log(`🎹 MIDI device connected: ${app.midiInput.name}`);
            }
        } else {
            // Disconnect
            const deviceName = document.getElementById('deviceName');
            const statusIndicator = document.getElementById('statusIndicator');
            
            if (deviceName) deviceName.textContent = 'Kein Gerät verbunden';
            if (statusIndicator) statusIndicator.classList.remove('connected');
            
            app.midiInput = null;
        }
    }

    // Handle MIDI messages
    function handleMIDIMessage(app, event) {
        const [status, control, value] = event.data;
        
        // Handle MIDI learn mode
        if (app.midiLearnMode) {
            handleMidiLearn(app, status, control, value);
            return;
        }
        
        const isCC = (status & 0xF0) === 0xB0;      // Control Change
        const isNoteOn = (status & 0xF0) === 0x90;  // Note On
        const isNoteOff = (status & 0xF0) === 0x80; // Note Off
        
        if (isCC) {
            handleControlChange(app, control, value);
        } else if (isNoteOn && value > 0) {
            handleNoteOn(app, control, value);
        } else if (isNoteOff || (isNoteOn && value === 0)) {
            handleNoteOff(app, control);
        }
    }

    // Handle Control Change (CC) messages
    function handleControlChange(app, control, value) {
        // Smooth CC values for less jittery behavior
        const key = `cc_${control}`;
        if (!midiValues[key]) midiValues[key] = value;
        midiValues[key] = midiValues[key] * (1 - MIDI_SMOOTHING) + value * MIDI_SMOOTHING;
        
        const smoothedValue = Math.round(midiValues[key]);
        const channel = app.audioChannels.find(ch => ch.midiCC === control);
        
        if (channel && window.AudioMixer) {
            const percent = Math.round((smoothedValue / 127) * 100);
            window.AudioMixer.updateChannelVolume(app, channel.id, percent);
            
            // Visual feedback
            showMIDIActivity(channel.id);
        }
    }

    // Handle Note On messages
    function handleNoteOn(app, note, velocity) {
        const hotkey = app.hotkeys.find(hk => hk.midiNote === note);
        if (hotkey && window.HotkeyManager) {
            window.HotkeyManager.executeHotkey(app, hotkey, 'press', velocity);
            window.HotkeyManager.highlightButton(hotkey.id, true);
        }
    }

    // Handle Note Off messages
    function handleNoteOff(app, note) {
        const hotkey = app.hotkeys.find(hk => hk.midiNote === note);
        if (hotkey && window.HotkeyManager) {
            window.HotkeyManager.executeHotkey(app, hotkey, 'release');
            window.HotkeyManager.highlightButton(hotkey.id, false);
        }
    }

    // Handle MIDI learn mode
    function handleMidiLearn(app, status, control, value) {
        const isCC = (status & 0xF0) === 0xB0;
        const isNoteOn = (status & 0xF0) === 0x90;
        
        if (app.midiLearnType === 'audio' && isCC) {
            const learnElement = document.getElementById('audioMidiLearn');
            if (learnElement) {
                learnElement.innerHTML = 
                    `<p style="color: var(--success)">✅ MIDI CC ${control} zugewiesen!</p>`;
            }
            
            if (app.currentEditIndex >= 0) {
                app.audioChannels[app.currentEditIndex].midiCC = control;
            } else {
                window.tempMidiCC = control;
            }
            
            app.midiLearnMode = false;
            setTimeout(() => {
                if (learnElement) learnElement.style.display = 'none';
            }, 2000);
            
        } else if (app.midiLearnType === 'hotkey' && isNoteOn && value > 0) {
            const learnElement = document.getElementById('hotkeyMidiLearn');
            if (learnElement) {
                learnElement.innerHTML = 
                    `<p style="color: var(--success)">✅ MIDI Note ${control} zugewiesen!</p>`;
            }
            
            if (app.currentEditIndex >= 0) {
                app.hotkeys[app.currentEditIndex].midiNote = control;
            } else {
                window.tempMidiNote = control;
            }
            
            app.midiLearnMode = false;
            setTimeout(() => {
                if (learnElement) learnElement.style.display = 'none';
            }, 2000);
        }
    }

    // Start MIDI learn process
    function startLearn(app, type) {
        if (!app.midiInput) {
            window.Utils.showNotification('Bitte verbinde zuerst ein MIDI-Gerät', 'error');
            return false;
        }
        
        app.midiLearnMode = true;
        app.midiLearnType = type;
        
        if (type === 'audio') {
            const learnElement = document.getElementById('audioMidiLearn');
            if (learnElement) {
                learnElement.style.display = 'block';
                learnElement.innerHTML = '<p>🎹 Bewege jetzt den gewünschten MIDI-Regler!</p>';
            }
        } else if (type === 'hotkey') {
            const learnElement = document.getElementById('hotkeyMidiLearn');
            if (learnElement) {
                learnElement.style.display = 'block';
                learnElement.innerHTML = '<p>🎹 Drücke jetzt den gewünschten MIDI-Button!</p>';
            }
        }
        
        return true;
    }

    // Stop MIDI learn process
    function stopLearn(app) {
        app.midiLearnMode = false;
        app.midiLearnType = null;
        
        const audioLearn = document.getElementById('audioMidiLearn');
        const hotkeyLearn = document.getElementById('hotkeyMidiLearn');
        
        if (audioLearn) audioLearn.style.display = 'none';
        if (hotkeyLearn) hotkeyLearn.style.display = 'none';
    }

    // Show MIDI activity indicator
    function showMIDIActivity(channelId) {
        const indicator = document.querySelector(`#channel-${channelId} .midi-indicator`);
        if (indicator) {
            indicator.classList.add('active');
            setTimeout(() => indicator.classList.remove('active'), 100);
        }
    }

    // Get MIDI device info
    function getDeviceInfo(app) {
        if (!app.midiInput) return null;
        
        return {
            name: app.midiInput.name,
            id: app.midiInput.id,
            manufacturer: app.midiInput.manufacturer,
            state: app.midiInput.state,
            connection: app.midiInput.connection
        };
    }

    // Send MIDI message (if output is available)
    function sendMIDIMessage(app, message) {
        // For future implementation of MIDI output
        console.log('MIDI Out:', message);
    }

    // Get all available MIDI devices
    function getAvailableDevices(app) {
        if (!app.midiAccess) return { inputs: [], outputs: [] };
        
        const inputs = Array.from(app.midiAccess.inputs.values()).map(input => ({
            id: input.id,
            name: input.name,
            manufacturer: input.manufacturer,
            state: input.state
        }));
        
        const outputs = Array.from(app.midiAccess.outputs.values()).map(output => ({
            id: output.id,
            name: output.name,
            manufacturer: output.manufacturer,
            state: output.state
        }));
        
        return { inputs, outputs };
    }

    // Test MIDI connection
    async function testConnection(app) {
        if (!app.midiInput) {
            window.Utils.showNotification('Kein MIDI-Gerät verbunden', 'warning');
            return false;
        }
        
        window.Utils.showNotification(`Teste Verbindung zu ${app.midiInput.name}...`, 'info');
        
        // Set up test listener
        let testReceived = false;
        const testHandler = () => {
            testReceived = true;
        };
        
        app.midiInput.addEventListener('midimessage', testHandler);
        
        // Wait for MIDI input
        setTimeout(() => {
            app.midiInput.removeEventListener('midimessage', testHandler);
            
            if (testReceived) {
                window.Utils.showNotification('✅ MIDI-Verbindung funktioniert!', 'success');
            } else {
                window.Utils.showNotification('⚠️ Keine MIDI-Signale empfangen. Bewege einen Regler oder drücke eine Taste.', 'warning');
            }
        }, 5000);
        
        return true;
    }

    // Public API
    return {
        init,
        updateDeviceList,
        connectDevice,
        handleMIDIMessage,
        startLearn,
        stopLearn,
        getDeviceInfo,
        sendMIDIMessage,
        getAvailableDevices,
        testConnection
    };
})();