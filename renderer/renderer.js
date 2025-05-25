// Global state
let midiAccess = null;
let midiInput = null;
let audioChannels = [];
let hotkeys = [];
let currentEditIndex = -1;
let midiLearnMode = null;
let midiLearnType = null;
let resizing = false;
let obsWebSocket = null;
let audioContext = null;
let virtualCableOutput = null;

// OBS WebSocket
class OBSController {
    constructor() {
        this.ws = null;
        this.connected = false;
    }

    async connect(url, password) {
        try {
            // Check if OBSWebSocket is available
            if (typeof OBSWebSocket === 'undefined') {
                console.error('OBS WebSocket library not loaded');
                showNotification('OBS WebSocket Bibliothek nicht geladen', 'error');
                return false;
            }
            
            const OBSWebSocketLib = window.OBSWebSocket;
            this.ws = new OBSWebSocketLib();
            await this.ws.connect(url, password);
            this.connected = true;
            console.log('OBS WebSocket connected');
            showNotification('OBS erfolgreich verbunden', 'success');
            return true;
        } catch (error) {
            console.error('OBS connection failed:', error);
            showNotification('OBS Verbindung fehlgeschlagen', 'error');
            this.connected = false;
            return false;
        }
    }

    async getScenes() {
        if (!this.connected) return [];
        try {
            const { scenes } = await this.ws.call('GetSceneList');
            return scenes.map(s => s.sceneName);
        } catch (error) {
            console.error('Failed to get scenes:', error);
            return [];
        }
    }

    async setScene(sceneName) {
        if (!this.connected) return false;
        try {
            await this.ws.call('SetCurrentProgramScene', { sceneName });
            return true;
        } catch (error) {
            console.error('Failed to set scene:', error);
            return false;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.disconnect();
            this.connected = false;
        }
    }
}

const obsController = new OBSController();

// Initialize the app
async function init() {
    console.log('Initializing MIDI Controller App...');
    
    try {
        await initMIDI();
        console.log('MIDI initialized');
    } catch (error) {
        console.error('MIDI init failed:', error);
    }
    
    try {
        await loadConfig();
        console.log('Config loaded');
    } catch (error) {
        console.error('Config load failed:', error);
    }
    
    setupResizeHandle();
    console.log('Resize handle setup');
    
    initAudioContext();
    console.log('Audio context initialized');
    
    await initVirtualAudioOutput();
    console.log('Virtual audio initialized');
    
    // Load available audio sources
    await updateAudioSources();
    console.log('Audio sources updated');
    
    // Initialize drag and drop
    initDragAndDrop();
    console.log('Drag and drop initialized');
    
    console.log('App initialization complete');
}

function initDragAndDrop() {
    // For audio channels
    const audioContainer = document.getElementById('audioChannels');
    if (audioContainer) {
        audioContainer.addEventListener('dragover', handleDragOver);
        audioContainer.addEventListener('drop', handleDrop);
    }
    
    // For hotkeys
    const hotkeyContainer = document.getElementById('hotkeyGrid');
    if (hotkeyContainer) {
        hotkeyContainer.addEventListener('dragover', handleDragOver);
        hotkeyContainer.addEventListener('drop', handleDrop);
    }
}

function handleDragStart(e, type, index) {
    draggedElement = e.target;
    draggedType = type;
    draggedIndex = index;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragEnd(e) {
    e.target.style.opacity = '';
    draggedElement = null;
    draggedType = null;
    draggedIndex = -1;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(e.currentTarget, e.clientY);
    const draggable = document.querySelector('.dragging');
    
    if (afterElement == null) {
        e.currentTarget.appendChild(draggable);
    } else {
        e.currentTarget.insertBefore(draggable, afterElement);
    }
    
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (!draggedElement || draggedIndex < 0) return false;
    
    const dropIndex = getDropIndex(e.currentTarget, e.clientY);
    
    if (draggedType === 'audio') {
        // Reorder audio channels
        const [removed] = audioChannels.splice(draggedIndex, 1);
        audioChannels.splice(dropIndex, 0, removed);
        saveConfig();
        renderAudioChannels();
    } else if (draggedType === 'hotkey') {
        // Reorder hotkeys
        const [removed] = hotkeys.splice(draggedIndex, 1);
        hotkeys.splice(dropIndex, 0, removed);
        saveConfig();
        renderHotkeys();
    }
    
    return false;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.audio-channel:not(.dragging), .hotkey-button:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getDropIndex(container, y) {
    const elements = [...container.children];
    let dropIndex = elements.length;
    
    for (let i = 0; i < elements.length; i++) {
        const box = elements[i].getBoundingClientRect();
        if (y < box.top + box.height / 2) {
            dropIndex = i;
            break;
        }
    }
    
    return dropIndex;
}

// Virtual Audio Output
async function initVirtualAudioOutput() {
    const config = await window.electronAPI.loadConfig();
    if (config.settings && config.settings.virtualOutput) {
        virtualCableOutput = await window.electronAPI.createVirtualOutput('MIDI Controller Mix');
    }
}

// Audio Sources
async function updateAudioSources() {
    const sources = await window.electronAPI.getAudioSources();
    const select = document.getElementById('audioSource');
    select.innerHTML = '';
    
    sources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = source.name;
        select.appendChild(option);
    });
}

// MIDI Initialization
async function initMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        updateMIDIDevices();
        midiAccess.addEventListener('statechange', updateMIDIDevices);
    } catch (error) {
        console.error('MIDI access failed:', error);
        showNotification('MIDI-Zugriff fehlgeschlagen', 'error');
    }
}

function updateMIDIDevices() {
    const select = document.getElementById('midiDeviceSelect');
    select.innerHTML = '<option value="">Kein Gerät ausgewählt</option>';
    
    for (const input of midiAccess.inputs.values()) {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name;
        select.appendChild(option);
    }
}

function connectMIDIDevice(deviceId) {
    if (midiInput) {
        midiInput.removeEventListener('midimessage', handleMIDIMessage);
    }
    
    if (deviceId) {
        midiInput = midiAccess.inputs.get(deviceId);
        if (midiInput) {
            midiInput.addEventListener('midimessage', handleMIDIMessage);
            document.getElementById('deviceName').textContent = midiInput.name;
            document.getElementById('statusIndicator').classList.add('connected');
            showNotification(`${midiInput.name} verbunden`, 'success');
        }
    } else {
        document.getElementById('deviceName').textContent = 'Kein Gerät verbunden';
        document.getElementById('statusIndicator').classList.remove('connected');
    }
}

// MIDI Message Handling with smoothing
let midiValues = {};
const MIDI_SMOOTHING = 0.3;

function handleMIDIMessage(event) {
    const [status, control, value] = event.data;
    
    if (midiLearnMode) {
        handleMidiLearn(status, control, value);
        return;
    }
    
    const isCC = (status & 0xF0) === 0xB0;
    const isNoteOn = (status & 0xF0) === 0x90;
    const isNoteOff = (status & 0xF0) === 0x80;
    
    if (isCC) {
        // Smooth CC values
        const key = `cc_${control}`;
        if (!midiValues[key]) midiValues[key] = value;
        midiValues[key] = midiValues[key] * (1 - MIDI_SMOOTHING) + value * MIDI_SMOOTHING;
        
        const smoothedValue = Math.round(midiValues[key]);
        const channel = audioChannels.find(ch => ch.midiCC === control);
        
        if (channel) {
            const percent = Math.round((smoothedValue / 127) * 100);
            updateChannelVolume(channel.id, percent);
            
            // Visual feedback
            const indicator = document.querySelector(`#channel-${channel.id} .midi-indicator`);
            if (indicator) {
                indicator.classList.add('active');
                setTimeout(() => indicator.classList.remove('active'), 100);
            }
        }
    } else if (isNoteOn) {
        const hotkey = hotkeys.find(hk => hk.midiNote === control);
        if (hotkey) {
            executeHotkey(hotkey, 'press');
            highlightHotkeyButton(hotkey.id, true);
        }
    } else if (isNoteOff) {
        const hotkey = hotkeys.find(hk => hk.midiNote === control);
        if (hotkey) {
            executeHotkey(hotkey, 'release');
            highlightHotkeyButton(hotkey.id, false);
        }
    }
}

function handleMidiLearn(status, control, value) {
    if (midiLearnType === 'audio' && (status & 0xF0) === 0xB0) {
        document.getElementById('audioMidiLearn').innerHTML = 
            `<p style="color: var(--success)">MIDI CC ${control} zugewiesen!</p>`;
        
        if (currentEditIndex >= 0) {
            audioChannels[currentEditIndex].midiCC = control;
        } else {
            window.tempMidiCC = control;
        }
        
        midiLearnMode = false;
        setTimeout(() => {
            document.getElementById('audioMidiLearn').style.display = 'none';
        }, 2000);
    } else if (midiLearnType === 'hotkey' && (status & 0xF0) === 0x90) {
        document.getElementById('hotkeyMidiLearn').innerHTML = 
            `<p style="color: var(--success)">MIDI Note ${control} zugewiesen!</p>`;
        
        if (currentEditIndex >= 0) {
            hotkeys[currentEditIndex].midiNote = control;
        } else {
            window.tempMidiNote = control;
        }
        
        midiLearnMode = false;
        setTimeout(() => {
            document.getElementById('hotkeyMidiLearn').style.display = 'none';
        }, 2000);
    }
}

// Audio Context and Analysis
let previewGainNode = null;

function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain node
    window.masterGain = audioContext.createGain();
    window.masterGain.connect(audioContext.destination);
    
    // Create preview gain node
    previewGainNode = audioContext.createGain();
    previewGainNode.gain.value = 0.5;
    previewGainNode.connect(window.masterGain);
}

// Preview functionality
async function togglePreview(channelId) {
    const channel = audioChannels.find(ch => ch.id === channelId);
    if (!channel) return;
    
    channel.previewing = !channel.previewing;
    
    if (channel.previewing) {
        // Start preview
        showNotification(`Preview: ${channel.name}`, 'info');
        channel.isActive = true;
        
        // In a real implementation, this would connect to the actual audio source
        // For demo: create oscillator to test
        if (!channel.previewOscillator) {
            channel.previewOscillator = audioContext.createOscillator();
            channel.previewGain = audioContext.createGain();
            channel.previewOscillator.connect(channel.previewGain);
            channel.previewGain.connect(previewGainNode);
            channel.previewOscillator.frequency.value = 440 + (Math.random() * 200);
            channel.previewOscillator.start();
        }
        
        channel.previewGain.gain.value = channel.muted ? 0 : (channel.volume / 100) * 0.3;
    } else {
        // Stop preview
        channel.isActive = false;
        if (channel.previewOscillator) {
            channel.previewOscillator.stop();
            channel.previewOscillator = null;
            channel.previewGain = null;
        }
    }
    
    renderAudioChannels();
}

// Update volume with preview support
function updateChannelVolume(channelId, value) {
    const channel = audioChannels.find(ch => ch.id === channelId);
    if (channel) {
        channel.volume = value;
        document.getElementById(`volume-${channelId}`).style.width = value + '%';
        document.querySelector(`#channel-${channelId} .volume-handle`).style.left = value + '%';
        document.getElementById(`volume-value-${channelId}`).textContent = value + '%';
        
        // Update preview volume if active
        if (channel.previewing && channel.previewGain) {
            channel.previewGain.gain.value = channel.muted ? 0 : (value / 100) * 0.3;
        }
        
        // Route audio with new volume
        if (!channel.muted) {
            routeChannelAudio(channelId, value);
        }
        
        saveConfigDebounced();
    }
}

// Audio routing to virtual cable
async function routeChannelAudio(channelId, volume) {
    if (!virtualCableOutput) return;
    
    const channel = audioChannels.find(ch => ch.id === channelId);
    if (channel) {
        await window.electronAPI.routeAudio(channel.source, virtualCableOutput.deviceId, volume);
    }
}

// UI Functions
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
    updateOBSScenes();
}

async function saveSettings() {
    const deviceId = document.getElementById('midiDeviceSelect').value;
    const obsWebsocket = document.getElementById('obsWebsocket').value;
    const obsPassword = document.getElementById('obsPassword').value;
    const enableVirtual = document.getElementById('enableVirtualOutput').checked;
    
    const settings = {
        deviceId,
        obsWebsocket,
        obsPassword,
        virtualOutput: enableVirtual
    };
    
    const config = await window.electronAPI.loadConfig();
    config.settings = settings;
    await window.electronAPI.saveConfig(config);
    
    connectMIDIDevice(deviceId);
    
    if (obsWebsocket) {
        await obsController.connect(obsWebsocket, obsPassword);
    }
    
    if (enableVirtual && !virtualCableOutput) {
        await initVirtualAudioOutput();
    }
    
    closeModal('settingsModal');
    showNotification('Einstellungen gespeichert', 'success');
}

async function loadConfig() {
    const config = await window.electronAPI.loadConfig();
    
    if (config.settings) {
        const { deviceId, obsWebsocket, obsPassword, virtualOutput } = config.settings;
        
        if (document.getElementById('midiDeviceSelect')) {
            document.getElementById('midiDeviceSelect').value = deviceId || '';
        }
        if (document.getElementById('obsWebsocket')) {
            document.getElementById('obsWebsocket').value = obsWebsocket || '';
        }
        if (document.getElementById('obsPassword')) {
            document.getElementById('obsPassword').value = obsPassword || '';
        }
        if (document.getElementById('enableVirtualOutput')) {
            document.getElementById('enableVirtualOutput').checked = virtualOutput || false;
        }
        
        if (deviceId) {
            setTimeout(() => connectMIDIDevice(deviceId), 1000);
        }
        
        if (obsWebsocket) {
            obsController.connect(obsWebsocket, obsPassword);
        }
    }
    
    audioChannels = config.audioChannels || [];
    hotkeys = config.hotkeys || [];
    
    renderAudioChannels();
    renderHotkeys();
}

// Audio Channel Management
function addAudioChannel() {
    currentEditIndex = -1;
    window.tempMidiCC = null;
    document.getElementById('audioName').value = '';
    document.getElementById('audioSource').value = document.getElementById('audioSource').options[0]?.value || '';
    document.getElementById('audioMidiLearn').style.display = 'none';
    document.getElementById('audioModal').classList.add('active');
}

async function saveAudioChannel() {
    const name = document.getElementById('audioName').value;
    const source = document.getElementById('audioSource').value;
    
    if (!name) {
        showNotification('Bitte gib einen Namen ein', 'error');
        return;
    }
    
    const channel = {
        id: currentEditIndex >= 0 ? audioChannels[currentEditIndex].id : Date.now(),
        name,
        source,
        volume: 70,
        muted: false,
        midiCC: window.tempMidiCC || (currentEditIndex >= 0 ? audioChannels[currentEditIndex].midiCC : null)
    };
    
    if (currentEditIndex >= 0) {
        audioChannels[currentEditIndex] = channel;
    } else {
        audioChannels.push(channel);
    }
    
    await saveConfig();
    renderAudioChannels();
    closeModal('audioModal');
    showNotification(`Audio-Kanal "${name}" ${currentEditIndex >= 0 ? 'aktualisiert' : 'hinzugefügt'}`, 'success');
}

function deleteAudioChannel(index) {
    if (confirm(`Möchtest du "${audioChannels[index].name}" wirklich löschen?`)) {
        audioChannels.splice(index, 1);
        saveConfig();
        renderAudioChannels();
        showNotification('Audio-Kanal gelöscht', 'info');
    }
}

function renderAudioChannels() {
    const container = document.getElementById('audioChannels');
    container.innerHTML = '';
    
    audioChannels.forEach((channel, index) => {
        const div = document.createElement('div');
        div.className = 'audio-channel';
        div.id = `channel-${channel.id}`;
        div.draggable = true;
        div.addEventListener('dragstart', (e) => handleDragStart(e, 'audio', index));
        div.addEventListener('dragend', handleDragEnd);
        div.innerHTML = `
            <div class="channel-header">
                <span class="channel-name">${channel.name}</span>
                <div class="channel-controls">
                    <button class="preview-btn ${channel.previewing ? 'active' : ''}" 
                            onclick="togglePreview(${channel.id})" title="Preview">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                    </button>
                    <button class="mute-btn ${channel.muted ? 'muted' : ''}" 
                            onclick="toggleMute(${channel.id})" title="Stummschalten">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="${channel.muted ? 
                                'M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-7-8l-1.88 1.88L12 7.76zm4.5 8A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z' :
                                'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'}" />
                        </svg>
                    </button>
                    <div class="midi-indicator ${channel.midiCC ? 'configured' : ''}" 
                         title="MIDI CC: ${channel.midiCC || 'Nicht zugewiesen'}"></div>
                    <div class="drag-handle" title="Verschieben">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                    </div>
                    <button class="icon-btn" onclick="editAudioChannel(${index})" title="Bearbeiten">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="icon-btn delete" onclick="deleteAudioChannel(${index})" title="Löschen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="volume-container">
                <div class="volume-slider" onmousedown="startVolumeDrag(event, ${channel.id})">
                    <div class="volume-fill" id="volume-${channel.id}" style="width: ${channel.volume}%"></div>
                    <div class="volume-handle" style="left: ${channel.volume}%"></div>
                </div>
                <span class="volume-value" id="volume-value-${channel.id}">${channel.volume}%</span>
            </div>
            <div class="vu-meter">
                <div class="vu-meter-fill" id="vu-${channel.id}"></div>
            </div>
        `;
        container.appendChild(div);
    });
    
    // Start VU meter animation
    animateVUMeters();
}

// Improved volume control with dragging
let volumeDragging = false;
let volumeDragChannel = null;

function startVolumeDrag(event, channelId) {
    volumeDragging = true;
    volumeDragChannel = channelId;
    updateVolumeDrag(event);
    
    document.addEventListener('mousemove', updateVolumeDrag);
    document.addEventListener('mouseup', stopVolumeDrag);
    event.preventDefault();
}

function updateVolumeDrag(event) {
    if (!volumeDragging) return;
    
    const slider = document.querySelector(`#channel-${volumeDragChannel} .volume-slider`);
    const rect = slider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    updateChannelVolume(volumeDragChannel, Math.round(percent));
}

function stopVolumeDrag() {
    volumeDragging = false;
    volumeDragChannel = null;
    document.removeEventListener('mousemove', updateVolumeDrag);
    document.removeEventListener('mouseup', stopVolumeDrag);
}

function updateChannelVolume(channelId, value) {
    const channel = audioChannels.find(ch => ch.id === channelId);
    if (channel) {
        channel.volume = value;
        document.getElementById(`volume-${channelId}`).style.width = value + '%';
        document.querySelector(`#channel-${channelId} .volume-handle`).style.left = value + '%';
        document.getElementById(`volume-value-${channelId}`).textContent = value + '%';
        
        // Route audio with new volume
        if (!channel.muted) {
            routeChannelAudio(channelId, value);
        }
        
        saveConfigDebounced();
    }
}

function toggleMute(channelId) {
    const channel = audioChannels.find(ch => ch.id === channelId);
    if (channel) {
        channel.muted = !channel.muted;
        const btn = document.querySelector(`#channel-${channelId} .mute-btn`);
        btn.classList.toggle('muted', channel.muted);
        
        // Update audio routing
        routeChannelAudio(channelId, channel.muted ? 0 : channel.volume);
        
        saveConfig();
    }
}

// Debounced save for performance
let saveTimeout;
function saveConfigDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveConfig, 500);
}

async function saveConfig() {
    const config = await window.electronAPI.loadConfig();
    config.audioChannels = audioChannels;
    config.hotkeys = hotkeys;
    await window.electronAPI.saveConfig(config);
}

// VU Meter Animation
let animationFrame;
function animateVUMeters() {
    audioChannels.forEach(channel => {
        const vuMeter = document.getElementById(`vu-${channel.id}`);
        if (vuMeter) {
            // Only show levels when audio is actually playing/routed
            let targetLevel = 0;
            
            if (!channel.muted && channel.isActive) {
                // Simulate realistic audio level with occasional peaks
                const baseLevel = channel.volume * 0.3; // Lower base level
                const variation = Math.random() * 20; // Less variation
                const occasional = Math.random() > 0.95 ? Math.random() * 30 : 0; // Occasional peaks
                targetLevel = Math.min(100, baseLevel + variation + occasional);
            }
            
            // Smooth transition with faster decay
            const currentWidth = parseFloat(vuMeter.style.width) || 0;
            const decay = targetLevel < currentWidth ? 0.15 : 0.3;
            const newWidth = currentWidth + (targetLevel - currentWidth) * decay;
            vuMeter.style.width = Math.max(0, newWidth) + '%';
            
            // Color based on level
            if (newWidth > 90) {
                vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #ffeb3b 70%, #f44336 90%)';
            } else if (newWidth > 70) {
                vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #ffeb3b 70%)';
            } else {
                vuMeter.style.background = '#4caf50';
            }
        }
    });
    
    animationFrame = requestAnimationFrame(animateVUMeters);
}

// Hotkey Management
function addHotkey() {
    currentEditIndex = -1;
    window.tempMidiNote = null;
    document.getElementById('hotkeyName').value = '';
    document.getElementById('hotkeyAction').value = 'play_sound';
    document.getElementById('hotkeyParameter').value = '';
    document.getElementById('hotkeyMidiLearn').style.display = 'none';
    updateActionConfig();
    document.getElementById('hotkeyModal').classList.add('active');
}

function editHotkey(index) {
    currentEditIndex = index;
    const hotkey = hotkeys[index];
    document.getElementById('hotkeyName').value = hotkey.name;
    document.getElementById('hotkeyAction').value = hotkey.action;
    document.getElementById('hotkeyParameter').value = hotkey.parameter || '';
    document.getElementById('hotkeyMode').value = hotkey.mode || 'press';
    document.getElementById('hotkeyMidiLearn').style.display = 'none';
    updateActionConfig();
    document.getElementById('hotkeyModal').classList.add('active');
}

async function saveHotkey() {
    const name = document.getElementById('hotkeyName').value;
    const action = document.getElementById('hotkeyAction').value;
    const parameter = document.getElementById('hotkeyParameter').value;
    const mode = document.getElementById('hotkeyMode').value;
    
    if (!name) {
        showNotification('Bitte gib einen Namen ein', 'error');
        return;
    }
    
    const hotkey = {
        id: currentEditIndex >= 0 ? hotkeys[currentEditIndex].id : Date.now(),
        name,
        action,
        parameter,
        mode,
        midiNote: window.tempMidiNote || (currentEditIndex >= 0 ? hotkeys[currentEditIndex].midiNote : null)
    };
    
    if (currentEditIndex >= 0) {
        hotkeys[currentEditIndex] = hotkey;
    } else {
        hotkeys.push(hotkey);
    }
    
    await saveConfig();
    renderHotkeys();
    closeModal('hotkeyModal');
    showNotification(`Hotkey "${name}" ${currentEditIndex >= 0 ? 'aktualisiert' : 'hinzugefügt'}`, 'success');
}

function deleteHotkey(index) {
    if (confirm(`Möchtest du "${hotkeys[index].name}" wirklich löschen?`)) {
        hotkeys.splice(index, 1);
        saveConfig();
        renderHotkeys();
        showNotification('Hotkey gelöscht', 'info');
    }
}

function renderHotkeys() {
    const container = document.getElementById('hotkeyGrid');
    container.innerHTML = '';
    
    hotkeys.forEach((hotkey, index) => {
        const div = document.createElement('div');
        div.className = 'hotkey-button';
        div.id = `hotkey-${hotkey.id}`;
        div.draggable = true;
        div.addEventListener('dragstart', (e) => handleDragStart(e, 'hotkey', index));
        div.addEventListener('dragend', handleDragEnd);
        div.onclick = () => editHotkey(index);
        
        const actionIcon = getActionIcon(hotkey.action);
        
        div.innerHTML = `
            <div class="hotkey-label">${hotkey.midiNote ? `MIDI ${hotkey.midiNote}` : 'Nicht zugewiesen'}</div>
            <div class="hotkey-icon">${actionIcon}</div>
            <div class="hotkey-action">${hotkey.name}</div>
            <div class="hotkey-mode">${hotkey.mode === 'hold' ? 'Halten' : 'Drücken'}</div>
            <button class="icon-btn delete hotkey-delete" onclick="event.stopPropagation(); deleteHotkey(${index})" title="Löschen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            </button>
        `;
        container.appendChild(div);
    });
}

function getActionIcon(action) {
    const icons = {
        'play_sound': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        'obs_scene': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>',
        'mute_audio': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
        'trigger_effect': '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
    };
    return icons[action] || icons['play_sound'];
}

function highlightHotkeyButton(hotkeyId, active) {
    const button = document.getElementById(`hotkey-${hotkeyId}`);
    if (button) {
        button.classList.toggle('active', active);
    }
}

let audioPlaying = {};

async function executeHotkey(hotkey, eventType) {
    if (hotkey.mode === 'press' && eventType !== 'press') return;
    if (hotkey.mode === 'hold' && eventType === 'release') {
        // Stop action for hold mode
        if (hotkey.action === 'play_sound' && audioPlaying[hotkey.id]) {
            audioPlaying[hotkey.id].pause();
            delete audioPlaying[hotkey.id];
        }
        return;
    }
    
    switch (hotkey.action) {
        case 'play_sound':
            if (hotkey.parameter) {
                try {
                    const audio = new Audio(hotkey.parameter);
                    audio.play();
                    if (hotkey.mode === 'hold') {
                        audio.loop = true;
                        audioPlaying[hotkey.id] = audio;
                    }
                    showNotification(`Sound wird abgespielt`, 'info');
                } catch (error) {
                    showNotification(`Fehler beim Abspielen der Datei`, 'error');
                }
            }
            break;
            
        case 'obs_scene':
            if (obsController.connected && hotkey.parameter) {
                const success = await obsController.setScene(hotkey.parameter);
                if (success) {
                    showNotification(`OBS Szene gewechselt: ${hotkey.parameter}`, 'success');
                } else {
                    showNotification(`Fehler beim Szenenwechsel`, 'error');
                }
            } else {
                showNotification(`OBS nicht verbunden`, 'error');
            }
            break;
            
        case 'mute_audio':
            const channel = audioChannels.find(ch => ch.name === hotkey.parameter);
            if (channel) {
                toggleMute(channel.id);
                showNotification(`${channel.name} ${channel.muted ? 'stummgeschaltet' : 'aktiviert'}`, 'info');
            }
            break;
    }
}

// Action configuration
function updateActionConfig() {
    const action = document.getElementById('hotkeyAction').value;
    const configDiv = document.getElementById('actionConfig');
    const paramInput = document.getElementById('hotkeyParameter');
    
    switch (action) {
        case 'play_sound':
            configDiv.innerHTML = `
                <label class="form-label">Audio-Datei</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" class="form-input" id="hotkeyParameter" 
                           placeholder="Pfad zur Audio-Datei" readonly>
                    <button class="btn btn-secondary" onclick="selectAudioFile()">Durchsuchen</button>
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
            updateOBSScenes();
            break;
            
        case 'mute_audio':
            configDiv.innerHTML = `
                <label class="form-label">Audio-Kanal</label>
                <select class="form-select" id="hotkeyParameter">
                    <option value="">Kanal auswählen...</option>
                    ${audioChannels.map(ch => `<option value="${ch.name}">${ch.name}</option>`).join('')}
                </select>
            `;
            break;
    }
    
    // Restore value if editing
    if (currentEditIndex >= 0 && hotkeys[currentEditIndex].parameter) {
        setTimeout(() => {
            const newParamInput = document.getElementById('hotkeyParameter');
            if (newParamInput) {
                newParamInput.value = hotkeys[currentEditIndex].parameter;
            }
        }, 50);
    }
}

async function selectAudioFile() {
    const filePath = await window.electronAPI.selectAudioFile();
    if (filePath) {
        document.getElementById('hotkeyParameter').value = filePath;
    }
}

async function updateOBSScenes() {
    if (!obsController.connected) return;
    
    const scenes = await obsController.getScenes();
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
}

// Resize Handle
function setupResizeHandle() {
    const handle = document.getElementById('resizeHandle');
    const audioPanel = document.getElementById('audioPanel');
    const hotkeyPanel = document.getElementById('hotkeyPanel');
    const container = document.querySelector('.main-container');
    
    let startX = 0;
    let startWidth = 0;
    
    handle.addEventListener('mousedown', (e) => {
        resizing = true;
        startX = e.clientX;
        startWidth = audioPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        
        const diff = e.clientX - startX;
        const newWidth = startWidth + diff;
        const containerWidth = container.offsetWidth;
        const minWidth = 300;
        const maxWidth = containerWidth - 250;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            audioPanel.style.flex = `0 0 ${newWidth}px`;
            handle.style.left = `${newWidth}px`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        resizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    });
    
    // Set initial position
    setTimeout(() => {
        const audioWidth = audioPanel.offsetWidth;
        handle.style.left = `${audioWidth}px`;
    }, 100);
}

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    midiLearnMode = false;
    midiLearnType = null;
    currentEditIndex = -1;
    window.tempMidiCC = null;
    window.tempMidiNote = null;
}

function startMidiLearn(type) {
    if (!midiInput) {
        showNotification('Bitte verbinde zuerst ein MIDI-Gerät', 'error');
        return;
    }
    
    midiLearnMode = true;
    midiLearnType = type;
    
    if (type === 'audio') {
        document.getElementById('audioMidiLearn').style.display = 'block';
        document.getElementById('audioMidiLearn').innerHTML = '<p>Bewege jetzt den gewünschten MIDI-Regler!</p>';
    } else {
        document.getElementById('hotkeyMidiLearn').style.display = 'block';
        document.getElementById('hotkeyMidiLearn').innerHTML = '<p>Drücke jetzt den gewünschten MIDI-Button!</p>';
    }
}

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                saveConfig();
                showNotification('Konfiguration gespeichert', 'success');
                break;
            case 'a':
                if (e.shiftKey) {
                    e.preventDefault();
                    addAudioChannel();
                }
                break;
            case 'h':
                if (e.shiftKey) {
                    e.preventDefault();
                    addHotkey();
                }
                break;
        }
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', init);

// Cleanup
window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    if (obsController) {
        obsController.disconnect();
    }
    if (audioContext) {
        audioContext.close();
    }
});

// Master Preview Control
let masterVolume = 70;
let masterPreviewing = false;

function toggleMasterPreview() {
    masterPreviewing = !masterPreviewing;
    const btn = document.getElementById('masterPreviewBtn');
    
    if (masterPreviewing) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        showNotification('Master Preview aktiviert', 'success');
        
        // Enable all channel previews
        audioChannels.forEach(channel => {
            if (!channel.muted) {
                channel.isActive = true;
            }
        });
    } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        showNotification('Master Preview deaktiviert', 'info');
        
        // Disable non-previewing channels
        audioChannels.forEach(channel => {
            if (!channel.previewing) {
                channel.isActive = false;
            }
        });
    }
    
    // Update master gain
    if (window.masterGain) {
        window.masterGain.gain.value = masterPreviewing ? (masterVolume / 100) : 0;
    }
}

function startMasterVolumeDrag(event) {
    const slider = event.currentTarget;
    const rect = slider.getBoundingClientRect();
    
    function updateMasterVolume(e) {
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        masterVolume = Math.round(percent);
        
        document.getElementById('master-volume').style.width = masterVolume + '%';
        document.querySelector('.master-volume .volume-handle').style.left = masterVolume + '%';
        document.getElementById('master-volume-value').textContent = masterVolume + '%';
        
        if (window.masterGain && masterPreviewing) {
            window.masterGain.gain.value = masterVolume / 100;
        }
    }
    
    function stopDrag() {
        document.removeEventListener('mousemove', updateMasterVolume);
        document.removeEventListener('mouseup', stopDrag);
    }
    
    updateMasterVolume(event);
    document.addEventListener('mousemove', updateMasterVolume);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
}

// Update VU meters to include master
function animateVUMeters() {
    // Channel VU meters
    audioChannels.forEach(channel => {
        const vuMeter = document.getElementById(`vu-${channel.id}`);
        if (vuMeter) {
            let targetLevel = 0;
            
            if (!channel.muted && channel.isActive) {
                const baseLevel = channel.volume * 0.3;
                const variation = Math.random() * 20;
                const occasional = Math.random() > 0.95 ? Math.random() * 30 : 0;
                targetLevel = Math.min(100, baseLevel + variation + occasional);
            }
            
            const currentWidth = parseFloat(vuMeter.style.width) || 0;
            const decay = targetLevel < currentWidth ? 0.15 : 0.3;
            const newWidth = currentWidth + (targetLevel - currentWidth) * decay;
            vuMeter.style.width = Math.max(0, newWidth) + '%';
            
            if (newWidth > 90) {
                vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #ffeb3b 70%, #f44336 90%)';
            } else if (newWidth > 70) {
                vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #ffeb3b 70%)';
            } else {
                vuMeter.style.background = '#4caf50';
            }
        }
    });
    
    // Master VU meter
    const masterVu = document.getElementById('master-vu');
    if (masterVu && masterPreviewing) {
        // Calculate average of all active channels
        let avgLevel = 0;
        let activeCount = 0;
        
        audioChannels.forEach(channel => {
            if (!channel.muted && channel.isActive) {
                activeCount++;
                avgLevel += (channel.volume * 0.3) + (Math.random() * 15);
            }
        });
        
        if (activeCount > 0) {
            avgLevel = Math.min(100, (avgLevel / activeCount) * (masterVolume / 100));
        }
        
        const currentWidth = parseFloat(masterVu.style.width) || 0;
        const newWidth = currentWidth + (avgLevel - currentWidth) * 0.2;
        masterVu.style.width = Math.max(0, newWidth) + '%';
    } else if (masterVu) {
        const currentWidth = parseFloat(masterVu.style.width) || 0;
        masterVu.style.width = Math.max(0, currentWidth * 0.8) + '%';
    }
    
    animationFrame = requestAnimationFrame(animateVUMeters);
}

// Expose functions to global scope for onclick handlers
window.openSettings = openSettings;
window.saveSettings = saveSettings;
window.closeModal = closeModal;
window.addAudioChannel = addAudioChannel;
window.saveAudioChannel = saveAudioChannel;
window.deleteAudioChannel = deleteAudioChannel;
window.editAudioChannel = editAudioChannel;
window.addHotkey = addHotkey;
window.saveHotkey = saveHotkey;
window.deleteHotkey = deleteHotkey;
window.editHotkey = editHotkey;
window.startMidiLearn = startMidiLearn;
window.selectAudioFile = selectAudioFile;
window.updateActionConfig = updateActionConfig;
window.toggleMute = toggleMute;
window.startVolumeDrag = startVolumeDrag;
window.editAudioChannel = editAudioChannel;
window.togglePreview = togglePreview;