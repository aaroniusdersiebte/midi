// renderer/modules/obs-controller.js
// Enhanced OBS WebSocket integration with better error handling

window.OBSController = (function() {
    
    // Initialize OBS controller
    async function init(app) {
        console.log('📹 Initializing OBS Controller...');
        
        try {
            console.log('✅ OBS Controller initialized');
            
        } catch (error) {
            console.error('❌ OBS Controller initialization failed:', error);
            window.Utils.showNotification('OBS Controller Initialisierung fehlgeschlagen', 'error');
        }
    }

    // Connect to OBS WebSocket with better error handling
    async function connect(app, url, password) {
        try {
            console.log(`🔗 Attempting to connect to OBS at ${url}...`);
            
            // Check if OBS WebSocket is available
            if (!window.electronAPI || !window.electronAPI.isOBSAvailable()) {
                throw new Error('OBS WebSocket library not available. Run: npm install obs-websocket-js@5.0.6');
            }
            
            // Create OBS WebSocket instance
            app.obsWebSocket = window.electronAPI.createOBSWebSocket();
            console.log('📦 OBS WebSocket instance created');
            
            // Setup event listeners before connecting
            setupEventListeners(app);
            
            // Validate URL format
            if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                url = 'ws://' + url;
            }
            
            console.log(`🔗 Connecting to: ${url}`);
            
            // Set connection timeout
            const connectionTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000);
            });
            
            // Attempt connection with optional password
            const connectionPromise = password ? 
                app.obsWebSocket.connect(url, password) : 
                app.obsWebSocket.connect(url);
            
            // Race between connection and timeout
            await Promise.race([connectionPromise, connectionTimeout]);
            
            console.log('✅ OBS WebSocket connected successfully');
            window.Utils.showNotification('✅ OBS erfolgreich verbunden', 'success');
            
            // Get initial scene list
            await updateSceneList(app);
            
            return true;
            
        } catch (error) {
            console.error('❌ OBS connection failed:', error);
            
            // Provide specific error messages
            let errorMessage = 'OBS Verbindung fehlgeschlagen';
            
            if (error.message.includes('ECONNREFUSED')) {
                errorMessage = 'OBS nicht erreichbar - ist OBS geöffnet und WebSocket Server aktiv?';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Verbindungszeit überschritten - überprüfe URL und Netzwerk';
            } else if (error.message.includes('Authentication')) {
                errorMessage = 'Falsches Passwort - überprüfe WebSocket Server Einstellungen';
            } else if (error.message.includes('not available')) {
                errorMessage = 'OBS WebSocket Plugin fehlt - installiere obs-websocket-js';
            }
            
            window.Utils.showNotification(errorMessage, 'error');
            
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

    // Setup OBS event listeners with better error handling
    function setupEventListeners(app) {
        if (!app.obsWebSocket) return;
        
        try {
            // Connection events
            app.obsWebSocket.on('ConnectionOpened', () => {
                console.log('📹 OBS connection opened');
            });
            
            app.obsWebSocket.on('ConnectionClosed', () => {
                console.log('📹 OBS connection closed');
                window.Utils.showNotification('OBS Verbindung getrennt', 'warning');
            });
            
            app.obsWebSocket.on('ConnectionError', (error) => {
                console.error('📹 OBS connection error:', error);
                window.Utils.showNotification('OBS Verbindungsfehler: ' + error.message, 'error');
            });
            
            // Authentication events
            app.obsWebSocket.on('AuthenticationSuccess', () => {
                console.log('📹 OBS authentication successful');
            });
            
            app.obsWebSocket.on('AuthenticationFailure', (error) => {
                console.error('📹 OBS authentication failed:', error);
                window.Utils.showNotification('OBS Authentifizierung fehlgeschlagen', 'error');
            });
            
            // Scene events
            app.obsWebSocket.on('CurrentProgramSceneChanged', (data) => {
                console.log(`📺 Scene changed to: ${data.sceneName}`);
                window.Utils.showNotification(`📺 OBS Szene: ${data.sceneName}`, 'info');
            });
            
            // Streaming events
            app.obsWebSocket.on('StreamStateChanged', (data) => {
                const state = data.outputActive ? 'gestartet' : 'gestoppt';
                console.log(`📡 Stream ${state}`);
                window.Utils.showNotification(`📡 Stream ${state}`, data.outputActive ? 'success' : 'info');
            });
            
            // Recording events
            app.obsWebSocket.on('RecordStateChanged', (data) => {
                const state = data.outputActive ? 'gestartet' : 'gestoppt';
                console.log(`🔴 Recording ${state}`);
                window.Utils.showNotification(`🔴 Aufnahme ${state}`, data.outputActive ? 'success' : 'info');
            });
            
        } catch (error) {
            console.error('Error setting up OBS event listeners:', error);
        }
    }

    // Get scene list with error handling
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
            window.Utils.showNotification('Fehler beim Abrufen der OBS Szenen: ' + error.message, 'error');
            return [];
        }
    }

    // Set current scene with error handling
    async function setScene(app, sceneName) {
        if (!app.obsWebSocket || !isConnected(app)) {
            console.warn('OBS not connected');
            window.Utils.showNotification('OBS nicht verbunden', 'error');
            return false;
        }
        
        try {
            await app.obsWebSocket.call('SetCurrentProgramScene', { sceneName });
            console.log(`📺 Scene changed to: ${sceneName}`);
            return true;
            
        } catch (error) {
            console.error('Failed to set OBS scene:', error);
            window.Utils.showNotification(`Fehler beim Wechseln zur Szene "${sceneName}": ${error.message}`, 'error');
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
            window.Utils.showNotification('📡 Stream gestartet', 'success');
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
            window.Utils.showNotification('📡 Stream gestoppt', 'info');
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
            window.Utils.showNotification('🔴 Aufnahme gestartet', 'success');
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
            window.Utils.showNotification('🔴 Aufnahme gestoppt', 'info');
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
            
            console.log(`📋 Scene list updated: ${scenes.length} scenes`);
            
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
        return app.obsWebSocket && 
               app.obsWebSocket.identified && 
               app.obsWebSocket.socket && 
               app.obsWebSocket.socket.readyState === WebSocket.OPEN;
    }

    // Get connection info
    function getConnectionInfo(app) {
        if (!app.obsWebSocket) {
            return {
                connected: false,
                url: null,
                version: null,
                status: 'No WebSocket instance'
            };
        }
        
        return {
            connected: isConnected(app),
            url: app.obsWebSocket.address || null,
            version: app.obsWebSocket.obsWebSocketVersion || null,
            rpcVersion: app.obsWebSocket.rpcVersion || null,
            status: isConnected(app) ? 'Connected' : 'Disconnected'
        };
    }

    // Test OBS connection with detailed diagnostics
    async function testConnection(app, url, password) {
        try {
            window.Utils.showNotification('🔍 Teste OBS Verbindung...', 'info');
            
            console.log('📋 OBS Connection Test Started');
            console.log(`URL: ${url}`);
            console.log(`Password: ${password ? '[SET]' : '[NONE]'}`);
            
            // Check if OBS WebSocket library is available
            if (!window.electronAPI || !window.electronAPI.isOBSAvailable()) {
                throw new Error('OBS WebSocket library not available. Install with: npm install obs-websocket-js@5.0.6');
            }
            
            // Create test WebSocket
            const testWS = window.electronAPI.createOBSWebSocket();
            console.log('📦 Test WebSocket instance created');
            
            // Validate URL format
            if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
                url = 'ws://' + url;
            }
            
            // Setup test timeout
            const testTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection test timeout (15s)')), 15000);
            });
            
            // Attempt connection
            const connectionPromise = password ? 
                testWS.connect(url, password) : 
                testWS.connect(url);
            
            await Promise.race([connectionPromise, testTimeout]);
            console.log('✅ Test connection established');
            
            // Get version info
            const version = await testWS.call('GetVersion');
            console.log('📋 OBS Version:', version);
            
            // Get some basic info
            const scenes = await testWS.call('GetSceneList');
            console.log(`📋 Found ${scenes.scenes.length} scenes`);
            
            // Disconnect test connection
            await testWS.disconnect();
            console.log('📋 Test connection closed');
            
            window.Utils.showNotification(
                `✅ OBS Test erfolgreich!\nVersion: ${version.obsVersion}\nSzenen: ${scenes.scenes.length}`, 
                'success'
            );
            
            return true;
            
        } catch (error) {
            console.error('❌ OBS connection test failed:', error);
            
            let diagnosticMessage = '❌ OBS Verbindungstest fehlgeschlagen:\n';
            
            if (error.message.includes('ECONNREFUSED')) {
                diagnosticMessage += '• OBS ist nicht geöffnet\n• WebSocket Server ist nicht aktiv\n• Überprüfe Tools → WebSocket Server Settings';
            } else if (error.message.includes('timeout')) {
                diagnosticMessage += '• Verbindung dauert zu lange\n• Überprüfe URL (Standard: ws://localhost:4455)\n• Überprüfe Firewall';
            } else if (error.message.includes('Authentication')) {
                diagnosticMessage += '• Falsches Passwort\n• Überprüfe WebSocket Server Settings in OBS';
            } else if (error.message.includes('not available')) {
                diagnosticMessage += '• OBS WebSocket Plugin fehlt\n• Führe aus: npm install obs-websocket-js@5.0.6';
            } else {
                diagnosticMessage += error.message;
            }
            
            window.Utils.showNotification(diagnosticMessage, 'error');
            return false;
        }
    }

    // Get detailed OBS status
    async function getDetailedStatus(app) {
        if (!app.obsWebSocket || !isConnected(app)) {
            return {
                connected: false,
                version: null,
                scenes: [],
                streaming: false,
                recording: false
            };
        }
        
        try {
            const [version, sceneList, streamStatus, recordStatus] = await Promise.all([
                app.obsWebSocket.call('GetVersion'),
                app.obsWebSocket.call('GetSceneList'),
                app.obsWebSocket.call('GetStreamStatus').catch(() => ({ outputActive: false })),
                app.obsWebSocket.call('GetRecordStatus').catch(() => ({ outputActive: false }))
            ]);
            
            return {
                connected: true,
                version: version.obsVersion,
                scenes: sceneList.scenes.map(s => s.sceneName),
                streaming: streamStatus.outputActive,
                recording: recordStatus.outputActive,
                currentScene: sceneList.currentProgramSceneName
            };
            
        } catch (error) {
            console.error('Failed to get detailed OBS status:', error);
            return {
                connected: false,
                error: error.message
            };
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
        updateScenes,
        isConnected,
        getConnectionInfo,
        testConnection,
        getDetailedStatus
    };
})();