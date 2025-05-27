// renderer/modules/hotkey-manager.js
// Hotkey management and execution

window.HotkeyManager = (function() {
    
    let audioPlaying = {};
    
    // Initialize hotkey manager
    async function init(app) {
        console.log('⌨️ Initializing Hotkey Manager...');
        
        try {
            // Setup event listeners
            setupEventListeners(app);
            
            console.log('✅ Hotkey Manager initialized');
            
        } catch (error) {
            console.error('❌ Hotkey Manager initialization failed:', error);
            window.Utils.showNotification('Hotkey Manager Initialisierung fehlgeschlagen', 'error');
        }
    }

    // Setup event listeners
    function setupEventListeners(app) {
        // Listen for action config changes
        const actionSelect = document.getElementById('hotkeyAction');
        if (actionSelect) {
            actionSelect.addEventListener('change', () => updateActionConfig(app));
        }
    }

    // Add hotkey
    function addHotkey(app) {
        app.currentEditIndex = -1;
        window.tempMidiNote = null;
        
        // Reset form
        const nameInput = document.getElementById('hotkeyName');
        const actionSelect = document.getElementById('hotkeyAction');
        const parameterInput = document.getElementById('hotkeyParameter');
        const modeSelect = document.getElementById('hotkeyMode');
        const learnElement = document.getElementById('hotkeyMidiLearn');
        
        if (nameInput) nameInput.value = '';
        if (actionSelect) actionSelect.value = 'play_sound';
        if (parameterInput) parameterInput.value = '';
        if (modeSelect) modeSelect.value = 'press';
        if (learnElement) learnElement.style.display = 'none';
        
        updateActionConfig(app);
        window.Utils.openModal('hotkeyModal');
    }

    // Edit hotkey
    function editHotkey(app, index) {
        app.currentEditIndex = index;
        const hotkey = app.hotkeys[index];
        
        if (hotkey) {
            const nameInput = document.getElementById('hotkeyName');
            const actionSelect = document.getElementById('hotkeyAction');
            const parameterInput = document.getElementById('hotkeyParameter');
            const modeSelect = document.getElementById('hotkeyMode');
            const learnElement = document.getElementById('hotkeyMidiLearn');
            
            if (nameInput) nameInput.value = hotkey.name;
            if (actionSelect) actionSelect.value = hotkey.action;
            if (parameterInput) parameterInput.value = hotkey.parameter || '';
            if (modeSelect) modeSelect.value = hotkey.mode || 'press';
            if (learnElement) learnElement.style.display = 'none';
            
            updateActionConfig(app);
            window.Utils.openModal('hotkeyModal');
        }
    }

    // Save hotkey
    async function saveHotkey(app) {
        const nameInput = document.getElementById('hotkeyName');
        const actionSelect = document.getElementById('hotkeyAction');
        const parameterInput = document.getElementById('hotkeyParameter');
        const modeSelect = document.getElementById('hotkeyMode');
        
        const name = nameInput?.value;
        const action = actionSelect?.value;
        const parameter = parameterInput?.value;
        const mode = modeSelect?.value;
        
        if (!name) {
            window.Utils.showNotification('Bitte gib einen Namen ein', 'error');
            return;
        }
        
        const hotkey = {
            id: app.currentEditIndex >= 0 ? app.hotkeys[app.currentEditIndex].id : window.Utils.generateId(),
            name,
            action,
            parameter,
            mode,
            midiNote: window.tempMidiNote || (app.currentEditIndex >= 0 ? app.hotkeys[app.currentEditIndex].midiNote : null)
        };
        
        if (app.currentEditIndex >= 0) {
            app.hotkeys[app.currentEditIndex] = hotkey;
        } else {
            app.hotkeys.push(hotkey);
        }
        
        await window.ConfigManager.saveConfig(app);
        renderHotkeys(app);
        window.Utils.closeModal('hotkeyModal');
        
        const action_text = app.currentEditIndex >= 0 ? 'aktualisiert' : 'hinzugefügt';
        window.Utils.showNotification(`Hotkey "${name}" ${action_text}`, 'success');
    }

    // Delete hotkey
    function deleteHotkey(app, index) {
        const hotkey = app.hotkeys[index];
        if (!hotkey) return;
        
        if (confirm(`Möchtest du "${hotkey.name}" wirklich löschen?`)) {
            // Stop any active audio
            if (audioPlaying[hotkey.id]) {
                audioPlaying[hotkey.id].pause();
                delete audioPlaying[hotkey.id];
            }
            
            app.hotkeys.splice(index, 1);
            window.ConfigManager.saveConfig(app);
            renderHotkeys(app);
            window.Utils.showNotification('Hotkey gelöscht', 'info');
        }
    }

    // Render hotkeys
    function renderHotkeys(app) {
        const container = document.getElementById('hotkeyGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        app.hotkeys.forEach((hotkey, index) => {
            const div = document.createElement('div');
            div.className = 'hotkey-button';
            div.id = `hotkey-${hotkey.id}`;
            div.draggable = true;
            div.onclick = () => editHotkey(app, index);
            
            const actionIcon = getActionIcon(hotkey.action);
            
            div.innerHTML = `
                <div class="hotkey-label">${hotkey.midiNote ? `MIDI ${hotkey.midiNote}` : 'Nicht zugewiesen'}</div>
                <div class="hotkey-icon">${actionIcon}</div>
                <div class="hotkey-action">${hotkey.name}</div>
                <div class="hotkey-mode">${hotkey.mode === 'hold' ? 'Halten' : 'Drücken'}</div>
                <button class="icon-btn delete hotkey-delete" onclick="event.stopPropagation(); window.HotkeyManager.deleteHotkey(window.APP_STATE, ${index})" title="Löschen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            `;
            
            container.appendChild(div);
        });
    }

    // Execute hotkey
    async function executeHotkey(app, hotkey, eventType, velocity = 127) {
        if (hotkey.mode === 'press' && eventType !== 'press') return;
        if (hotkey.mode === 'hold' && eventType === 'release') {
            // Stop action for hold mode
            await stopHotkeyAction(hotkey);
            return;
        }
        
        console.log(`🎯 Executing hotkey: ${hotkey.name} (${hotkey.action})`);
        
        switch (hotkey.action) {
            case 'play_sound':
                await executePlaySound(hotkey, velocity);
                break;
                
            case 'obs_scene':
                await executeOBSScene(app, hotkey);
                break;
                
            case 'mute_audio':
                await executeMuteAudio(app, hotkey);
                break;
                
            case 'trigger_effect':
                await executeTriggerEffect(app, hotkey);
                break;
                
            case 'toggle_preview':
                await executeTogglePreview(app, hotkey);
                break;
                
            case 'set_volume':
                await executeSetVolume(app, hotkey, velocity);
                break;
                
            default:
                console.warn(`Unknown hotkey action: ${hotkey.action}`);
        }
    }

    // Execute play sound action
    async function executePlaySound(hotkey, velocity = 127) {
        if (!hotkey.parameter) {
            window.Utils.showNotification('Keine Audio-Datei ausgewählt', 'error');
            return;
        }
        
        try {
            const audio = new Audio(hotkey.parameter);
            
            // Set volume based on MIDI velocity
            audio.volume = velocity / 127;
            
            await audio.play();
            
            if (hotkey.mode === 'hold') {
                audio.loop = true;
                audioPlaying[hotkey.id] = audio;
            }
            
            window.Utils.showNotification(`🔊 Sound wird abgespielt`, 'info');
            
        } catch (error) {
            console.error('Failed to play sound:', error);
            window.Utils.showNotification(`Fehler beim Abspielen: ${error.message}`, 'error');
        }
    }

    // Execute OBS scene change
    async function executeOBSScene(app, hotkey) {
        if (!hotkey.parameter) {
            window.Utils.showNotification('Keine OBS Szene ausgewählt', 'error');
            return;
        }
        
        if (!app.obsWebSocket || !app.obsWebSocket.connected) {
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return;
        }
        
        try {
            const success = await window.OBSController.setScene(app, hotkey.parameter);
            if (success) {
                window.Utils.showNotification(`📺 OBS Szene: ${hotkey.parameter}`, 'success');
            } else {
                window.Utils.showNotification('Fehler beim Szenenwechsel', 'error');
            }
        } catch (error) {
            console.error('OBS scene change failed:', error);
            window.Utils.showNotification(`OBS Fehler: ${error.message}`, 'error');
        }
    }

    // Execute mute audio action
    async function executeMuteAudio(app, hotkey) {
        if (!hotkey.parameter) {
            window.Utils.showNotification('Kein Audio-Kanal ausgewählt', 'error');
            return;
        }
        
        const channel = app.audioChannels.find(ch => ch.name === hotkey.parameter);
        if (channel && window.AudioMixer) {
            await window.AudioMixer.toggleMute(app, channel.id);
            const status = channel.muted ? 'stummgeschaltet' : 'aktiviert';
            window.Utils.showNotification(`🔇 ${channel.name} ${status}`, 'info');
        } else {
            window.Utils.showNotification(`Audio-Kanal "${hotkey.parameter}" nicht gefunden`, 'error');
        }
    }

    // Execute trigger effect action
    async function executeTriggerEffect(app, hotkey) {
        // Placeholder for custom effects
        window.Utils.showNotification(`⚡ Effekt ausgelöst: ${hotkey.parameter || 'Standard'}`, 'info');
        
        // Example: Flash screen effect
        document.body.style.filter = 'brightness(1.5)';
        setTimeout(() => {
            document.body.style.filter = '';
        }, 200);
    }

    // Execute toggle preview action
    async function executeTogglePreview(app, hotkey) {
        if (!hotkey.parameter) {
            // Toggle master preview
            if (window.AudioMixer) {
                window.AudioMixer.toggleMasterPreview(app);
            }
        } else {
            // Toggle specific channel preview
            const channel = app.audioChannels.find(ch => ch.name === hotkey.parameter);
            if (channel && window.AudioMixer) {
                await window.AudioMixer.togglePreview(app, channel.id);
            }
        }
    }

    // Execute set volume action
    async function executeSetVolume(app, hotkey, velocity = 127) {
        if (!hotkey.parameter) return;
        
        const [channelName, volumeStr] = hotkey.parameter.split(':');
        const targetVolume = volumeStr ? parseInt(volumeStr) : Math.round((velocity / 127) * 100);
        
        const channel = app.audioChannels.find(ch => ch.name === channelName);
        if (channel && window.AudioMixer) {
            await window.AudioMixer.updateChannelVolume(app, channel.id, targetVolume);
            window.Utils.showNotification(`🎚️ ${channel.name}: ${targetVolume}%`, 'info');
        }
    }

    // Stop hotkey action
    async function stopHotkeyAction(hotkey) {
        if (hotkey.action === 'play_sound' && audioPlaying[hotkey.id]) {
            audioPlaying[hotkey.id].pause();
            delete audioPlaying[hotkey.id];
        }
    }

    // Highlight hotkey button
    function highlightButton(hotkeyId, active) {
        const button = document.getElementById(`hotkey-${hotkeyId}`);
        if (button) {
            button.classList.toggle('active', active);
        }
    }

    // Update action configuration UI
    function updateActionConfig(app) {
        const actionSelect = document.getElementById('hotkeyAction');
        const configDiv = document.getElementById('actionConfig');
        
        if (!actionSelect || !configDiv) return;
        
        const action = actionSelect.value;
        
        switch (action) {
            case 'play_sound':
                configDiv.innerHTML = `
                    <label class="form-label">Audio-Datei</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" class="form-input" id="hotkeyParameter" 
                               placeholder="Pfad zur Audio-Datei" readonly>
                        <button class="btn btn-secondary" onclick="window.HotkeyManager.selectAudioFile()" type="button">Durchsuchen</button>
                    </div>
                `;
                break;
                
            case 'obs_scene':
                configDiv.innerHTML = `
                    <label class="form-label">OBS Szene</label>
                    <select class="form-select" id="hotkeyParameter">
                        <option value="">Szene auswählen...</option>
                    </select>
                `;
                updateOBSScenes(app);
                break;
                
            case 'mute_audio':
                configDiv.innerHTML = `
                    <label class="form-label">Audio-Kanal</label>
                    <select class="form-select" id="hotkeyParameter">
                        <option value="">Kanal auswählen...</option>
                        ${app.audioChannels.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join('')}
                    </select>
                `;
                break;
                
            case 'trigger_effect':
                configDiv.innerHTML = `
                    <label class="form-label">Effekt Parameter</label>
                    <input type="text" class="form-input" id="hotkeyParameter" 
                           placeholder="z.B. flash, shake, fade">
                `;
                break;
                
            case 'toggle_preview':
                configDiv.innerHTML = `
                    <label class="form-label">Preview Kanal (leer für Master)</label>
                    <select class="form-select" id="hotkeyParameter">
                        <option value="">Master Preview</option>
                        ${app.audioChannels.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join('')}
                    </select>
                `;
                break;
                
            case 'set_volume':
                configDiv.innerHTML = `
                    <label class="form-label">Kanal und Lautstärke</label>
                    <select class="form-select" id="hotkeyParameter">
                        <option value="">Kanal auswählen...</option>
                        ${app.audioChannels.map(ch => `<option value="${ch.name}:50">${ch.name} (50%)</option>`).join('')}
                    </select>
                    <small style="color: var(--text-dim); margin-top: 5px; display: block;">
                        Format: Kanalname:Lautstärke (z.B. "Musik:75")
                    </small>
                `;
                break;
                
            default:
                configDiv.innerHTML = `
                    <label class="form-label">Parameter</label>
                    <input type="text" class="form-input" id="hotkeyParameter" 
                           placeholder="Aktions-Parameter">
                `;
        }
        
        // Restore value if editing
        if (app.currentEditIndex >= 0 && app.hotkeys[app.currentEditIndex].parameter) {
            setTimeout(() => {
                const paramInput = document.getElementById('hotkeyParameter');
                if (paramInput) {
                    paramInput.value = app.hotkeys[app.currentEditIndex].parameter;
                }
            }, 50);
        }
    }

    // Select audio file
    async function selectAudioFile() {
        if (window.electronAPI) {
            const filePath = await window.electronAPI.selectAudioFile();
            if (filePath) {
                const paramInput = document.getElementById('hotkeyParameter');
                if (paramInput) {
                    paramInput.value = filePath;
                }
            }
        }
    }

    // Update OBS scenes
    async function updateOBSScenes(app) {
        if (!app.obsWebSocket || !app.obsWebSocket.connected) return;
        
        try {
            const scenes = await window.OBSController.getScenes(app);
            const select = document.getElementById('hotkeyParameter');
            
            if (select && select.tagName === 'SELECT') {
                select.innerHTML = '<option value="">Szene auswählen...</option>';
                scenes.forEach(scene => {
                    const option = document.createElement('option');
                    option.value = scene;
                    option.textContent = scene;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to update OBS scenes:', error);
        }
    }

    // Get action icon
    function getActionIcon(action) {
        const icons = {
            'play_sound': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
            'obs_scene': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>',
            'mute_audio': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
            'trigger_effect': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>',
            'toggle_preview': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>',
            'set_volume': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>'
        };
        return icons[action] || icons['play_sound'];
    }

    // Public API
    return {
        init,
        addHotkey,
        editHotkey,
        saveHotkey,
        deleteHotkey,
        renderHotkeys,
        executeHotkey,
        highlightButton,
        updateActionConfig,
        selectAudioFile,
        updateOBSScenes,
        getActionIcon
    };
})();