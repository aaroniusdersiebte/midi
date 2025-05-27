// renderer/modules/audio-mixer.js
// Audio mixing and channel management

window.AudioMixer = (function() {
    
    let volumeDragging = false;
    let volumeDragChannel = null;
    let previewGainNode = null;
    
    // Initialize audio mixer
    async function init(app) {
        console.log('🎛️ Initializing Audio Mixer...');
        
        try {
            // Initialize audio context
            initAudioContext(app);
            
            // Initialize virtual audio output
            await initVirtualOutput(app);
            
            // Load available audio sources
            await updateAudioSources();
            
            // Setup UI event listeners
            setupEventListeners(app);
            
            console.log('✅ Audio Mixer initialized');
            
        } catch (error) {
            console.error('❌ Audio Mixer initialization failed:', error);
            window.Utils.showNotification('Audio Mixer Initialisierung fehlgeschlagen', 'error');
        }
    }

    // Initialize Web Audio Context
    function initAudioContext(app) {
        app.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create master gain node
        app.masterGain = app.audioContext.createGain();
        app.masterGain.connect(app.audioContext.destination);
        
        // Create preview gain node
        previewGainNode = app.audioContext.createGain();
        previewGainNode.gain.value = 0.5;
        previewGainNode.connect(app.masterGain);
        
        console.log('🔊 Audio context initialized');
    }

    // Initialize virtual audio output
    async function initVirtualOutput(app) {
        if (window.electronAPI) {
            try {
                app.virtualCableOutput = await window.electronAPI.createVirtualOutput('MIDI Controller Mix');
                console.log('🔌 Virtual audio output created');
            } catch (error) {
                console.warn('Virtual audio output creation failed:', error);
            }
        }
    }

    // Update available audio sources
    async function updateAudioSources() {
        if (!window.electronAPI) return;
        
        try {
            const sources = await window.electronAPI.getAudioSources();
            const select = document.getElementById('audioSource');
            
            if (select) {
                select.innerHTML = '';
                sources.forEach(source => {
                    const option = document.createElement('option');
                    option.value = source.id;
                    option.textContent = source.name;
                    select.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error('Failed to update audio sources:', error);
        }
    }

    // Setup event listeners
    function setupEventListeners(app) {
        // Volume drag events
        document.addEventListener('mousemove', (e) => updateVolumeDrag(app, e));
        document.addEventListener('mouseup', () => stopVolumeDrag(app));
        
        // Master volume drag events
        document.addEventListener('mousemove', (e) => updateMasterVolumeDrag(app, e));
        document.addEventListener('mouseup', () => stopMasterVolumeDrag(app));
    }

    // Add audio channel
    function addChannel(app) {
        app.currentEditIndex = -1;
        window.tempMidiCC = null;
        
        // Reset form
        const nameInput = document.getElementById('audioName');
        const sourceSelect = document.getElementById('audioSource');
        const learnElement = document.getElementById('audioMidiLearn');
        
        if (nameInput) nameInput.value = '';
        if (sourceSelect) sourceSelect.value = sourceSelect.options[0]?.value || '';
        if (learnElement) learnElement.style.display = 'none';
        
        window.Utils.openModal('audioModal');
    }

    // Edit audio channel
    function editChannel(app, index) {
        app.currentEditIndex = index;
        const channel = app.audioChannels[index];
        
        if (channel) {
            const nameInput = document.getElementById('audioName');
            const sourceSelect = document.getElementById('audioSource');
            const learnElement = document.getElementById('audioMidiLearn');
            
            if (nameInput) nameInput.value = channel.name;
            if (sourceSelect) sourceSelect.value = channel.source;
            if (learnElement) learnElement.style.display = 'none';
            
            window.Utils.openModal('audioModal');
        }
    }

    // Save audio channel
    async function saveChannel(app) {
        const nameInput = document.getElementById('audioName');
        const sourceSelect = document.getElementById('audioSource');
        
        const name = nameInput?.value;
        const source = sourceSelect?.value;
        
        if (!name) {
            window.Utils.showNotification('Bitte gib einen Namen ein', 'error');
            return;
        }
        
        const channel = {
            id: app.currentEditIndex >= 0 ? app.audioChannels[app.currentEditIndex].id : window.Utils.generateId(),
            name,
            source,
            volume: 70,
            muted: false,
            previewing: false,
            isActive: false,
            midiCC: window.tempMidiCC || (app.currentEditIndex >= 0 ? app.audioChannels[app.currentEditIndex].midiCC : null)
        };
        
        if (app.currentEditIndex >= 0) {
            app.audioChannels[app.currentEditIndex] = channel;
        } else {
            app.audioChannels.push(channel);
        }
        
        await window.ConfigManager.saveConfig(app);
        renderChannels(app);
        window.Utils.closeModal('audioModal');
        
        const action = app.currentEditIndex >= 0 ? 'aktualisiert' : 'hinzugefügt';
        window.Utils.showNotification(`Audio-Kanal "${name}" ${action}`, 'success');
    }

    // Delete audio channel
    function deleteChannel(app, index) {
        const channel = app.audioChannels[index];
        if (!channel) return;
        
        if (confirm(`Möchtest du "${channel.name}" wirklich löschen?`)) {
            // Stop preview if active
            if (channel.previewing) {
                stopPreview(app, channel.id);
            }
            
            app.audioChannels.splice(index, 1);
            window.ConfigManager.saveConfig(app);
            renderChannels(app);
            window.Utils.showNotification('Audio-Kanal gelöscht', 'info');
        }
    }

    // Render audio channels
    function renderChannels(app) {
        const container = document.getElementById('audioChannels');
        if (!container) return;
        
        container.innerHTML = '';
        
        app.audioChannels.forEach((channel, index) => {
            const div = document.createElement('div');
            div.className = 'audio-channel';
            div.id = `channel-${channel.id}`;
            div.draggable = true;
            
            div.innerHTML = `
                <div class="channel-header">
                    <span class="channel-name">${channel.name}</span>
                    <div class="channel-controls">
                        <button class="preview-btn ${channel.previewing ? 'active' : ''}" 
                                onclick="window.AudioMixer.togglePreview(window.APP_STATE, ${channel.id})" title="Preview">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                            </svg>
                        </button>
                        <button class="mute-btn ${channel.muted ? 'muted' : ''}" 
                                onclick="window.AudioMixer.toggleMute(window.APP_STATE, ${channel.id})" title="Stummschalten">
                            ${getMuteIcon(channel.muted)}
                        </button>
                        <div class="midi-indicator ${channel.midiCC ? 'configured' : ''}" 
                             title="MIDI CC: ${channel.midiCC || 'Nicht zugewiesen'}"></div>
                        <div class="drag-handle" title="Verschieben">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </div>
                        <button class="icon-btn" onclick="window.AudioMixer.editChannel(window.APP_STATE, ${index})" title="Bearbeiten">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="icon-btn delete" onclick="window.AudioMixer.deleteChannel(window.APP_STATE, ${index})" title="Löschen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="volume-container">
                    <div class="volume-slider" onmousedown="window.AudioMixer.startVolumeDrag(window.APP_STATE, event, ${channel.id})">
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
    }

    // Toggle channel mute
    async function toggleMute(app, channelId) {
        const channel = app.audioChannels.find(ch => ch.id === channelId);
        if (!channel) return;
        
        channel.muted = !channel.muted;
        
        // Update UI
        const btn = document.querySelector(`#channel-${channelId} .mute-btn`);
        if (btn) {
            btn.classList.toggle('muted', channel.muted);
            btn.innerHTML = getMuteIcon(channel.muted);
        }
        
        // Update audio routing
        await routeChannelAudio(app, channelId, channel.muted ? 0 : channel.volume);
        
        // Update preview if active
        if (channel.previewing && channel.previewGain) {
            channel.previewGain.gain.value = channel.muted ? 0 : (channel.volume / 100) * 0.3;
        }
        
        await window.ConfigManager.saveConfig(app);
    }

    // Toggle channel preview
    async function togglePreview(app, channelId) {
        const channel = app.audioChannels.find(ch => ch.id === channelId);
        if (!channel) return;
        
        channel.previewing = !channel.previewing;
        
        if (channel.previewing) {
            await startPreview(app, channel);
        } else {
            await stopPreview(app, channelId);
        }
        
        // Update UI
        const btn = document.querySelector(`#channel-${channelId} .preview-btn`);
        if (btn) {
            btn.classList.toggle('active', channel.previewing);
        }
        
        renderChannels(app);
    }

    // Start channel preview
    async function startPreview(app, channel) {
        window.Utils.showNotification(`Preview: ${channel.name}`, 'info');
        channel.isActive = true;
        
        // Create audio nodes for preview (mock implementation)
        if (app.audioContext && !channel.previewOscillator) {
            channel.previewOscillator = app.audioContext.createOscillator();
            channel.previewGain = app.audioContext.createGain();
            
            channel.previewOscillator.connect(channel.previewGain);
            channel.previewGain.connect(previewGainNode);
            
            // Use different frequencies for different channels
            channel.previewOscillator.frequency.value = 440 + (channel.id % 8) * 50;
            channel.previewOscillator.type = 'sine';
            channel.previewOscillator.start();
            
            channel.previewGain.gain.value = channel.muted ? 0 : (channel.volume / 100) * 0.1;
        }
    }

    // Stop channel preview
    async function stopPreview(app, channelId) {
        const channel = app.audioChannels.find(ch => ch.id === channelId);
        if (!channel) return;
        
        channel.isActive = false;
        
        if (channel.previewOscillator) {
            try {
                channel.previewOscillator.stop();
            } catch (e) {
                // Oscillator already stopped
            }
            channel.previewOscillator = null;
            channel.previewGain = null;
        }
    }

    // Update channel volume
    async function updateChannelVolume(app, channelId, value) {
        const channel = app.audioChannels.find(ch => ch.id === channelId);
        if (!channel) return;
        
        channel.volume = window.Utils.clamp(value, 0, 100);
        
        // Update UI
        const volumeFill = document.getElementById(`volume-${channelId}`);
        const volumeHandle = document.querySelector(`#channel-${channelId} .volume-handle`);
        const volumeValue = document.getElementById(`volume-value-${channelId}`);
        
        if (volumeFill) volumeFill.style.width = channel.volume + '%';
        if (volumeHandle) volumeHandle.style.left = channel.volume + '%';
        if (volumeValue) volumeValue.textContent = channel.volume + '%';
        
        // Update preview volume if active
        if (channel.previewing && channel.previewGain) {
            channel.previewGain.gain.value = channel.muted ? 0 : (channel.volume / 100) * 0.1;
        }
        
        // Route audio with new volume
        if (!channel.muted) {
            await routeChannelAudio(app, channelId, channel.volume);
        }
        
        // Send to native audio API
        if (window.electronAPI && channel.source) {
            await window.electronAPI.setAppVolume(channel.source, channel.volume);
        }
        
        await window.ConfigManager.saveConfigDebounced(app);
    }

    // Start volume drag
    function startVolumeDrag(app, event, channelId) {
        volumeDragging = true;
        volumeDragChannel = channelId;
        updateVolumeDrag(app, event);
        event.preventDefault();
    }

    // Update volume drag
    function updateVolumeDrag(app, event) {
        if (!volumeDragging || !volumeDragChannel) return;
        
        const slider = document.querySelector(`#channel-${volumeDragChannel} .volume-slider`);
        if (!slider) return;
        
        const rect = slider.getBoundingClientRect();
        const percent = window.Utils.clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        updateChannelVolume(app, volumeDragChannel, Math.round(percent));
    }

    // Stop volume drag
    function stopVolumeDrag(app) {
        volumeDragging = false;
        volumeDragChannel = null;
    }

    // Route channel audio
    async function routeChannelAudio(app, channelId, volume) {
        if (!app.virtualCableOutput || !window.electronAPI) return;
        
        const channel = app.audioChannels.find(ch => ch.id === channelId);
        if (channel) {
            await window.electronAPI.routeAudio(channel.source, app.virtualCableOutput.deviceId, volume);
        }
    }

    // Master preview functions
    function toggleMasterPreview(app) {
        app.masterPreviewing = !app.masterPreviewing;
        const btn = document.getElementById('masterPreviewBtn');
        
        if (app.masterPreviewing) {
            if (btn) {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-secondary');
            }
            window.Utils.showNotification('Master Preview aktiviert', 'success');
            
            // Enable all channel previews
            app.audioChannels.forEach(channel => {
                if (!channel.muted) {
                    channel.isActive = true;
                }
            });
        } else {
            if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }
            window.Utils.showNotification('Master Preview deaktiviert', 'info');
            
            // Disable non-previewing channels
            app.audioChannels.forEach(channel => {
                if (!channel.previewing) {
                    channel.isActive = false;
                }
            });
        }
        
        // Update master gain
        if (app.masterGain) {
            app.masterGain.gain.value = app.masterPreviewing ? (app.masterVolume / 100) : 0;
        }
    }

    // Master volume drag
    let masterVolumeDragging = false;
    
    function startMasterVolumeDrag(app, event) {
        masterVolumeDragging = true;
        updateMasterVolumeDrag(app, event);
        event.preventDefault();
    }
    
    function updateMasterVolumeDrag(app, event) {
        if (!masterVolumeDragging) return;
        
        const slider = document.querySelector('.master-volume .volume-slider');
        if (!slider) return;
        
        const rect = slider.getBoundingClientRect();
        const percent = window.Utils.clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        
        app.masterVolume = Math.round(percent);
        
        // Update UI
        const volumeFill = document.getElementById('master-volume');
        const volumeHandle = document.querySelector('.master-volume .volume-handle');
        const volumeValue = document.getElementById('master-volume-value');
        
        if (volumeFill) volumeFill.style.width = app.masterVolume + '%';
        if (volumeHandle) volumeHandle.style.left = app.masterVolume + '%';
        if (volumeValue) volumeValue.textContent = app.masterVolume + '%';
        
        if (app.masterGain && app.masterPreviewing) {
            app.masterGain.gain.value = app.masterVolume / 100;
        }
    }
    
    function stopMasterVolumeDrag(app) {
        masterVolumeDragging = false;
    }

    // VU Meter management
    function startVUAnimation(app) {
        if (app.animationFrame) return;
        
        function animate() {
            updateVUMeters({ levels: [], isNativeAudio: app.isNativeAudio });
            app.animationFrame = requestAnimationFrame(animate);
        }
        
        animate();
    }

    function updateVUMeters(data) {
        const app = window.APP_STATE;
        if (!app) return;
        
        // Update channel VU meters
        app.audioChannels.forEach(channel => {
            const vuMeter = document.getElementById(`vu-${channel.id}`);
            if (!vuMeter) return;
            
            let targetLevel = 0;
            
            if (!channel.muted && (channel.isActive || channel.previewing)) {
                // Find level data for this channel
                const levelData = data.levels.find(l => l.id === channel.id);
                
                if (levelData) {
                    targetLevel = levelData.level * 100;
                } else {
                    // Simulate realistic audio levels
                    const baseLevel = channel.volume * 0.2;
                    const variation = Math.random() * 10;
                    const beat = Math.sin(Date.now() / 200) > 0.7 ? Math.random() * 15 : 0;
                    const peak = Math.random() > 0.99 ? Math.random() * 30 : 0;
                    
                    targetLevel = Math.min(100, baseLevel + variation + beat + peak);
                }
            }
            
            // Smooth animation
            const currentWidth = parseFloat(vuMeter.style.width) || 0;
            const attackTime = 0.7;
            const decayTime = 0.05;
            const decay = targetLevel < currentWidth ? decayTime : attackTime;
            const newWidth = currentWidth + (targetLevel - currentWidth) * decay;
            
            vuMeter.style.width = Math.max(0, newWidth) + '%';
            
            // Color coding
            updateVUMeterColor(vuMeter, newWidth);
        });
        
        // Update master VU meter
        updateMasterVUMeter(app);
    }

    function updateVUMeterColor(vuMeter, level) {
        if (level > 85) {
            vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #ffeb3b 60%, #ff9800 80%, #f44336 90%)';
        } else if (level > 70) {
            vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #8bc34a 50%, #ffeb3b 80%)';
        } else if (level > 40) {
            vuMeter.style.background = 'linear-gradient(to right, #4caf50 0%, #8bc34a 70%)';
        } else {
            vuMeter.style.background = '#4caf50';
        }
    }

    function updateMasterVUMeter(app) {
        const masterVu = document.getElementById('master-vu');
        if (!masterVu) return;
        
        if (app.masterPreviewing) {
            // Calculate weighted average of active channels
            let weightedLevel = 0;
            let totalWeight = 0;
            
            app.audioChannels.forEach(channel => {
                if (!channel.muted && (channel.isActive || channel.previewing)) {
                    const weight = channel.volume / 100;
                    const channelLevel = (channel.volume * 0.2) + (Math.random() * 10);
                    weightedLevel += channelLevel * weight;
                    totalWeight += weight;
                }
            });
            
            const avgLevel = totalWeight > 0 ? 
                Math.min(100, (weightedLevel / totalWeight) * (app.masterVolume / 100)) : 0;
            
            const currentWidth = parseFloat(masterVu.style.width) || 0;
            const newWidth = currentWidth + (avgLevel - currentWidth) * 0.3;
            masterVu.style.width = Math.max(0, newWidth) + '%';
            
            updateVUMeterColor(masterVu, newWidth);
        } else {
            // Fade out
            const currentWidth = parseFloat(masterVu.style.width) || 0;
            masterVu.style.width = Math.max(0, currentWidth * 0.9) + '%';
        }
    }

    // Helper functions
    function getMuteIcon(muted) {
        if (muted) {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-7-8l-1.88 1.88L12 7.76zm4.5 8A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
            </svg>`;
        } else {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>`;
        }
    }

    // Public API
    return {
        init,
        addChannel,
        editChannel,
        saveChannel,
        deleteChannel,
        renderChannels,
        toggleMute,
        togglePreview,
        updateChannelVolume,
        startVolumeDrag,
        toggleMasterPreview,
        startMasterVolumeDrag,
        startVUAnimation,
        updateVUMeters,
        initVirtualOutput,
        updateAudioSources
    };
})();