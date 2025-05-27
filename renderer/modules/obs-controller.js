// renderer/modules/obs-controller.js
// OBS WebSocket integration

window.OBSController = (function() {
    
    // Initialize OBS controller
    async function init(app) {
        console.log('📹 Initializing OBS Controller...');
        
        try {
            // OBS WebSocket will be initialized when settings are loaded
            console.log('✅ OBS Controller initialized');
            
        } catch (error) {
            console.error('❌ OBS Controller initialization failed:', error);
            window.Utils.showNotification('OBS Controller Initialisierung fehlgeschlagen', 'error');
        }
    }

    // Connect to OBS WebSocket
    async function connect(app, url, password) {
        try {
            // Create OBS WebSocket instance
            if (window.electronAPI && window.electronAPI.createOBSWebSocket) {
                app.obsWebSocket = window.electronAPI.createOBSWebSocket();
            } else if (typeof OBSWebSocket !== 'undefined') {
                app.obsWebSocket = new OBSWebSocket();
            } else {
                throw new Error('OBS WebSocket library not available');
            }
            
            console.log(`🔗 Connecting to OBS at ${url}...`);
            
            // Connect with optional password
            if (password) {
                await app.obsWebSocket.connect(url, password);
            } else {
                await app.obsWebSocket.connect(url);
            }
            
            console.log('✅ OBS WebSocket connected successfully');
            window.Utils.showNotification('OBS erfolgreich verbunden', 'success');
            
            // Setup event listeners
            setupEventListeners(app);
            
            // Get initial scene list
            await updateSceneList(app);
            
            return true;
            
        } catch (error) {
            console.error('❌ OBS connection failed:', error);
            window.Utils.showNotification(`OBS Verbindung fehlgeschlagen: ${error.message}`, 'error');
            
            if (app.obsWebSocket) {
                app.obsWebSocket = null;
            }
            
            return false;
        }
    }

    // Disconnect from OBS
    function disconnect(app) {
        if (app.obsWebSocket) {
            try {
                app.obsWebSocket.disconnect();
                console.log('📹 OBS WebSocket disconnected');
                window.Utils.showNotification('OBS getrennt', 'info');
            } catch (error) {
                console.error('Error disconnecting from OBS:', error);
            }
            
            app.obsWebSocket = null;
        }
    }

    // Setup OBS event listeners
    function setupEventListeners(app) {
        if (!app.obsWebSocket) return;
        
        try {
            // Listen for scene changes
            app.obsWebSocket.on('CurrentProgramSceneChanged', (data) => {
                console.log(`📺 Scene changed to: ${data.sceneName}`);
                window.Utils.showNotification(`OBS Szene: ${data.sceneName}`, 'info');
            });
            
            // Listen for streaming state changes
            app.obsWebSocket.on('StreamStateChanged', (data) => {
                const state = data.outputActive ? 'gestartet' : 'gestoppt';
                console.log(`📡 Stream ${state}`);
                window.Utils.showNotification(`Stream ${state}`, data.outputActive ? 'success' : 'info');
            });
            
            // Listen for recording state changes
            app.obsWebSocket.on('RecordStateChanged', (data) => {
                const state = data.outputActive ? 'gestartet' : 'gestoppt';
                console.log(`🔴 Recording ${state}`);
                window.Utils.showNotification(`Aufnahme ${state}`, data.outputActive ? 'success' : 'info');
            });
            
            // Listen for connection errors
            app.obsWebSocket.on('ConnectionError', (error) => {
                console.error('OBS connection error:', error);
                window.Utils.showNotification('OBS Verbindungsfehler', 'error');
            });
            
            // Listen for authentication failures
            app.obsWebSocket.on('AuthenticationFailure', () => {
                console.error('OBS authentication failed');
                window.Utils.showNotification('OBS Authentifizierung fehlgeschlagen', 'error');
            });
            
        } catch (error) {
            console.error('Error setting up OBS event listeners:', error);
        }
    }

    // Get scene list
    async function getScenes(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            console.warn('OBS not connected');
            return [];
        }
        
        try {
            const response = await app.obsWebSocket.call('GetSceneList');
            const scenes = response.scenes.map(scene => scene.sceneName);
            console.log(`📋 Retrieved ${scenes.length} OBS scenes`);
            return scenes;
            
        } catch (error) {
            console.error('Failed to get OBS scenes:', error);
            window.Utils.showNotification('Fehler beim Abrufen der OBS Szenen', 'error');
            return [];
        }
    }

    // Set current scene
    async function setScene(app, sceneName) {
        if (!app.obsWebSocket || !isConnected(app)) {
            console.warn('OBS not connected');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('SetCurrentProgramScene', { sceneName });
            console.log(`📺 Scene changed to: ${sceneName}`);
            return true;
            
        } catch (error) {
            console.error('Failed to set OBS scene:', error);
            window.Utils.showNotification(`Fehler beim Wechseln zur Szene: ${sceneName}`, 'error');
            return false;
        }
    }

    // Get current scene
    async function getCurrentScene(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return null;
        }
        
        try {
            const response = await app.obsWebSocket.call('GetCurrentProgramScene');
            return response.currentProgramSceneName;
            
        } catch (error) {
            console.error('Failed to get current OBS scene:', error);
            return null;
        }
    }

    // Start streaming
    async function startStreaming(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('StartStream');
            console.log('📡 Stream started');
            window.Utils.showNotification('Stream gestartet', 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to start stream:', error);
            window.Utils.showNotification(`Fehler beim Stream-Start: ${error.message}`, 'error');
            return false;
        }
    }

    // Stop streaming
    async function stopStreaming(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('StopStream');
            console.log('📡 Stream stopped');
            window.Utils.showNotification('Stream gestoppt', 'info');
            return true;
            
        } catch (error) {
            console.error('Failed to stop stream:', error);
            window.Utils.showNotification(`Fehler beim Stream-Stop: ${error.message}`, 'error');
            return false;
        }
    }

    // Start recording
    async function startRecording(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('StartRecord');
            console.log('🔴 Recording started');
            window.Utils.showNotification('Aufnahme gestartet', 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            window.Utils.showNotification(`Fehler beim Aufnahme-Start: ${error.message}`, 'error');
            return false;
        }
    }

    // Stop recording
    async function stopRecording(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('StopRecord');
            console.log('🔴 Recording stopped');
            window.Utils.showNotification('Aufnahme gestoppt', 'info');
            return true;
            
        } catch (error) {
            console.error('Failed to stop recording:', error);
            window.Utils.showNotification(`Fehler beim Aufnahme-Stop: ${error.message}`, 'error');
            return false;
        }
    }

    // Get streaming status
    async function getStreamingStatus(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return { active: false, timecode: null };
        }
        
        try {
            const response = await app.obsWebSocket.call('GetStreamStatus');
            return {
                active: response.outputActive,
                timecode: response.outputTimecode,
                congestion: response.outputCongestion,
                bytes: response.outputBytes,
                skippedFrames: response.outputSkippedFrames,
                totalFrames: response.outputTotalFrames
            };
            
        } catch (error) {
            console.error('Failed to get streaming status:', error);
            return { active: false, timecode: null };
        }
    }

    // Get recording status
    async function getRecordingStatus(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return { active: false, timecode: null };
        }
        
        try {
            const response = await app.obsWebSocket.call('GetRecordStatus');
            return {
                active: response.outputActive,
                timecode: response.outputTimecode,
                bytes: response.outputBytes
            };
            
        } catch (error) {
            console.error('Failed to get recording status:', error);
            return { active: false, timecode: null };
        }
    }

    // Toggle source visibility
    async function toggleSource(app, sceneName, sourceName, visible = null) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return false;
        }
        
        try {
            if (visible === null) {
                // Get current visibility
                const response = await app.obsWebSocket.call('GetSceneItemEnabled', {
                    sceneName,
                    sceneItemId: await getSourceId(app, sceneName, sourceName)
                });
                visible = !response.sceneItemEnabled;
            }
            
            await app.obsWebSocket.call('SetSceneItemEnabled', {
                sceneName,
                sceneItemId: await getSourceId(app, sceneName, sourceName),
                sceneItemEnabled: visible
            });
            
            const status = visible ? 'eingeblendet' : 'ausgeblendet';
            window.Utils.showNotification(`${sourceName} ${status}`, 'info');
            return true;
            
        } catch (error) {
            console.error('Failed to toggle source:', error);
            window.Utils.showNotification(`Fehler beim Umschalten der Quelle: ${sourceName}`, 'error');
            return false;
        }
    }

    // Get source ID
    async function getSourceId(app, sceneName, sourceName) {
        try {
            const response = await app.obsWebSocket.call('GetSceneItemList', { sceneName });
            const item = response.sceneItems.find(item => item.sourceName === sourceName);
            return item ? item.sceneItemId : null;
            
        } catch (error) {
            console.error('Failed to get source ID:', error);
            return null;
        }
    }

    // Set source transform
    async function setSourceTransform(app, sceneName, sourceName, transform) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return false;
        }
        
        try {
            const sourceId = await getSourceId(app, sceneName, sourceName);
            if (!sourceId) {
                throw new Error(`Source ${sourceName} not found in scene ${sceneName}`);
            }
            
            await app.obsWebSocket.call('SetSceneItemTransform', {
                sceneName,
                sceneItemId: sourceId,
                sceneItemTransform: transform
            });
            
            console.log(`🎯 Transform set for ${sourceName}`);
            return true;
            
        } catch (error) {
            console.error('Failed to set source transform:', error);
            window.Utils.showNotification(`Fehler beim Setzen der Transformation: ${sourceName}`, 'error');
            return false;
        }
    }

    // Update scene list in UI
    async function updateSceneList(app) {
        try {
            const scenes = await getScenes(app);
            
            // Update hotkey modal if open
            const hotkeySelect = document.getElementById('hotkeyParameter');
            if (hotkeySelect && hotkeySelect.tagName === 'SELECT') {
                const currentAction = document.getElementById('hotkeyAction')?.value;
                if (currentAction === 'obs_scene') {
                    hotkeySelect.innerHTML = '<option value="">Szene auswählen...</option>';
                    scenes.forEach(scene => {
                        const option = document.createElement('option');
                        option.value = scene;
                        option.textContent = scene;
                        hotkeySelect.appendChild(option);
                    });
                }
            }
            
        } catch (error) {
            console.error('Failed to update scene list:', error);
        }
    }

    // Update scenes (public method for external calls)
    async function updateScenes(app) {
        return await updateSceneList(app);
    }

    // Check connection status
    function isConnected(app) {
        return app.obsWebSocket && app.obsWebSocket.identified;
    }

    // Get connection info
    function getConnectionInfo(app) {
        if (!app.obsWebSocket) {
            return {
                connected: false,
                url: null,
                version: null
            };
        }
        
        return {
            connected: isConnected(app),
            url: app.obsWebSocket.address || null,
            version: app.obsWebSocket.obsWebSocketVersion || null,
            rpcVersion: app.obsWebSocket.rpcVersion || null
        };
    }

    // Test OBS connection
    async function testConnection(app, url, password) {
        try {
            window.Utils.showNotification('Teste OBS Verbindung...', 'info');
            
            // Create temporary WebSocket for testing
            const testWS = window.electronAPI ? 
                window.electronAPI.createOBSWebSocket() : 
                new OBSWebSocket();
            
            if (password) {
                await testWS.connect(url, password);
            } else {
                await testWS.connect(url);
            }
            
            // Get version info
            const version = await testWS.call('GetVersion');
            
            // Disconnect test connection
            await testWS.disconnect();
            
            window.Utils.showNotification(
                `✅ OBS Verbindung erfolgreich! Version: ${version.obsVersion}`, 
                'success'
            );
            
            return true;
            
        } catch (error) {
            console.error('OBS connection test failed:', error);
            window.Utils.showNotification(
                `❌ OBS Verbindungstest fehlgeschlagen: ${error.message}`, 
                'error'
            );
            return false;
        }
    }

    // Get OBS stats
    async function getStats(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return null;
        }
        
        try {
            const stats = await app.obsWebSocket.call('GetStats');
            return {
                cpu: stats.cpuUsage,
                memory: stats.memoryUsage,
                fps: stats.activeFps,
                renderTotalFrames: stats.renderTotalFrames,
                renderSkippedFrames: stats.renderSkippedFrames,
                outputTotalFrames: stats.outputTotalFrames,
                outputSkippedFrames: stats.outputSkippedFrames
            };
            
        } catch (error) {
            console.error('Failed to get OBS stats:', error);
            return null;
        }
    }

    // Create scene collection
    async function createSceneCollection(app, name) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return false;
        }
        
        try {
            await app.obsWebSocket.call('CreateSceneCollection', { sceneCollectionName: name });
            window.Utils.showNotification(`Szenen-Sammlung "${name}" erstellt`, 'success');
            return true;
            
        } catch (error) {
            console.error('Failed to create scene collection:', error);
            window.Utils.showNotification(`Fehler beim Erstellen der Szenen-Sammlung: ${error.message}`, 'error');
            return false;
        }
    }

    // Public API
    return {
        init,
        connect,
        disconnect,
        getScenes,
        setScene,
        getCurrentScene,
        startStreaming,
        stopStreaming,
        startRecording,
        stopRecording,
        getStreamingStatus,
        getRecordingStatus,
        toggleSource,
        setSourceTransform,
        updateScenes,
        isConnected,
        getConnectionInfo,
        testConnection,
        getStats,
        createSceneCollection
    };
})();