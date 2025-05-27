// renderer/modules/ui-manager.js
// User Interface management and interactions

window.UIManager = (function() {
    
    let draggedElement = null;
    let draggedType = null;
    let draggedIndex = -1;
    let currentTooltip = null;
    
    // Initialize UI manager
    async function init(app) {
        console.log('🎨 Initializing UI Manager...');
        
        try {
            // Setup drag and drop
            initDragAndDrop(app);
            
            // Setup resize handles
            setupResizeHandle(app);
            
            // Setup modal handlers
            setupModalHandlers(app);
            
            // Setup global UI event listeners
            setupGlobalEventListeners(app);
            
            // Initialize tooltips
            initTooltips();
            
            // Initialize responsive design
            initResponsiveDesign(app);
            
            // Initialize keyboard shortcuts
            initKeyboardShortcuts(app);
            
            // Initialize accessibility features
            initAccessibility();
            
            console.log('✅ UI Manager initialized');
            
        } catch (error) {
            console.error('❌ UI Manager initialization failed:', error);
            window.Utils.showNotification('UI Manager Initialisierung fehlgeschlagen', 'error');
        }
    }

    // Initialize drag and drop
    function initDragAndDrop(app) {
        const audioContainer = document.getElementById('audioChannels');
        const hotkeyContainer = document.getElementById('hotkeyGrid');
        
        if (audioContainer) {
            audioContainer.addEventListener('dragover', handleDragOver);
            audioContainer.addEventListener('drop', (e) => handleDrop(app, e, 'audio'));
            audioContainer.addEventListener('dragenter', handleDragEnter);
            audioContainer.addEventListener('dragleave', handleDragLeave);
        }
        
        if (hotkeyContainer) {
            hotkeyContainer.addEventListener('dragover', handleDragOver);
            hotkeyContainer.addEventListener('drop', (e) => handleDrop(app, e, 'hotkey'));
            hotkeyContainer.addEventListener('dragenter', handleDragEnter);
            hotkeyContainer.addEventListener('dragleave', handleDragLeave);
        }
        
        console.log('🔄 Drag and drop initialized');
    }

    // Handle drag start
    function handleDragStart(app, e, type, index) {
        draggedElement = e.target;
        draggedType = type;
        draggedIndex = index;
        
        e.target.style.opacity = '0.5';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        
        // Add visual feedback to valid drop zones
        const dropZones = document.querySelectorAll(
            type === 'audio' ? '#audioChannels' : '#hotkeyGrid'
        );
        dropZones.forEach(zone => zone.classList.add('drag-target'));
        
        console.log(`🔄 Drag started: ${type} #${index}`);
    }

    // Handle drag end
    function handleDragEnd(e) {
        e.target.style.opacity = '';
        e.target.classList.remove('dragging');
        
        // Clean up drag indicators
        document.querySelectorAll('.drag-over, .drag-target').forEach(el => {
            el.classList.remove('drag-over', 'drag-target');
        });
        
        draggedElement = null;
        draggedType = null;
        draggedIndex = -1;
        
        console.log('🔄 Drag ended');
    }

    // Handle drag enter
    function handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    // Handle drag leave
    function handleDragLeave(e) {
        // Only remove if actually leaving the container
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    // Handle drag over
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        
        e.dataTransfer.dropEffect = 'move';
        
        // Visual feedback for drop position
        const container = e.currentTarget;
        const afterElement = getDragAfterElement(container, e.clientY);
        
        // Remove existing insertion indicators
        container.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        
        // Add insertion indicator
        if (afterElement == null) {
            // Insert at end
            const indicator = createDropIndicator();
            container.appendChild(indicator);
        } else {
            // Insert before element
            const indicator = createDropIndicator();
            container.insertBefore(indicator, afterElement);
        }
        
        return false;
    }

    // Create drop indicator
    function createDropIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            height: 2px;
            background: var(--secondary);
            margin: 4px 0;
            border-radius: 2px;
            animation: pulse 0.5s infinite;
        `;
        return indicator;
    }

    // Get element after mouse position
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.audio-channel, .hotkey-button')]
            .filter(el => !el.classList.contains('dragging'));
        
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

    // Handle drop
    function handleDrop(app, e, targetType) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        // Clean up visual indicators
        e.currentTarget.classList.remove('drag-over');
        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
        
        if (!draggedElement || draggedIndex < 0 || draggedType !== targetType) {
            return false;
        }
        
        const dropIndex = getDropIndex(e.currentTarget, e.clientY);
        
        if (draggedType === 'audio') {
            // Reorder audio channels
            const [removed] = app.audioChannels.splice(draggedIndex, 1);
            const insertIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
            app.audioChannels.splice(insertIndex, 0, removed);
            
            window.ConfigManager.saveConfig(app);
            window.AudioMixer.renderChannels(app);
            
            window.Utils.showNotification(`Audio-Kanal verschoben`, 'info');
            
        } else if (draggedType === 'hotkey') {
            // Reorder hotkeys
            const [removed] = app.hotkeys.splice(draggedIndex, 1);
            const insertIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
            app.hotkeys.splice(insertIndex, 0, removed);
            
            window.ConfigManager.saveConfig(app);
            window.HotkeyManager.renderHotkeys(app);
            
            window.Utils.showNotification(`Hotkey verschoben`, 'info');
        }
        
        return false;
    }

    // Get drop index based on mouse position
    function getDropIndex(container, y) {
        const elements = [...container.children].filter(el => 
            !el.classList.contains('dragging') && 
            !el.classList.contains('drop-indicator') &&
            !el.classList.contains('add-button')
        );
        
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

    // Setup resize handle
    function setupResizeHandle(app) {
        const handle = document.getElementById('resizeHandle');
        const audioPanel = document.getElementById('audioPanel');
        const hotkeyPanel = document.getElementById('hotkeyPanel');
        const container = document.querySelector('.main-container');
        
        if (!handle || !audioPanel || !hotkeyPanel || !container) return;
        
        let startX = 0;
        let startWidth = 0;
        let isResizing = false;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = audioPanel.offsetWidth;
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            handle.classList.add('active');
            
            // Add overlay to prevent iframe interference
            const overlay = document.createElement('div');
            overlay.id = 'resize-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                cursor: col-resize;
                z-index: 9999;
            `;
            document.body.appendChild(overlay);
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const diff = e.clientX - startX;
            const newWidth = startWidth + diff;
            const containerWidth = container.offsetWidth;
            const minWidth = 300;
            const maxWidth = containerWidth - 250;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                audioPanel.style.flex = `0 0 ${newWidth}px`;
                handle.style.left = `${newWidth}px`;
                
                // Update stored preference
                if (window.Utils.setLocalStorage) {
                    window.Utils.setLocalStorage('audioPanelWidth', newWidth);
                }
                
                // Dispatch resize event for components
                window.dispatchEvent(new Event('resize'));
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                handle.classList.remove('active');
                
                // Remove overlay
                const overlay = document.getElementById('resize-overlay');
                if (overlay) overlay.remove();
                
                console.log('📏 Panel resize completed');
            }
        });
        
        // Set initial position
        setTimeout(() => {
            const savedWidth = window.Utils.getLocalStorage('audioPanelWidth');
            if (savedWidth && savedWidth > 300) {
                audioPanel.style.flex = `0 0 ${savedWidth}px`;
                handle.style.left = `${savedWidth}px`;
            } else {
                const audioWidth = audioPanel.offsetWidth;
                handle.style.left = `${audioWidth}px`;
            }
        }, 100);
        
        console.log('📏 Resize handle initialized');
    }

    // Setup modal handlers
    function setupModalHandlers(app) {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                const modalId = e.target.id;
                window.Utils.closeModal(modalId);
            }
        });
        
        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    window.Utils.closeModal(activeModal.id);
                }
                
                // Also hide context menu and tooltips
                hideContextMenu();
                hideTooltip();
            }
        });
        
        // Setup form validation
        setupFormValidation();
        
        // Setup modal focus management
        setupModalFocus();
        
        console.log('📋 Modal handlers initialized');
    }

    // Setup form validation
    function setupFormValidation() {
        // Real-time validation for audio channel name
        const audioNameInput = document.getElementById('audioName');
        if (audioNameInput) {
            audioNameInput.addEventListener('input', (e) => {
                validateField(e.target, 'audioName');
            });
            
            audioNameInput.addEventListener('blur', (e) => {
                validateField(e.target, 'audioName');
            });
        }
        
        // Real-time validation for hotkey name
        const hotkeyNameInput = document.getElementById('hotkeyName');
        if (hotkeyNameInput) {
            hotkeyNameInput.addEventListener('input', (e) => {
                validateField(e.target, 'hotkeyName');
            });
            
            hotkeyNameInput.addEventListener('blur', (e) => {
                validateField(e.target, 'hotkeyName');
            });
        }
    }

    // Validate individual field
    function validateField(field, fieldType) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        switch (fieldType) {
            case 'audioName':
                isValid = value.length >= 1 && value.length <= 50;
                errorMessage = 'Name muss zwischen 1 und 50 Zeichen lang sein';
                break;
            case 'hotkeyName':
                isValid = value.length >= 1 && value.length <= 30;
                errorMessage = 'Name muss zwischen 1 und 30 Zeichen lang sein';
                break;
        }
        
        field.classList.toggle('invalid', !isValid && value.length > 0);
        
        if (!isValid && value.length > 0) {
            showFieldError(field, errorMessage);
        } else {
            hideFieldError(field);
        }
        
        return isValid;
    }

    // Show field error
    function showFieldError(field, message) {
        hideFieldError(field);
        
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        error.style.cssText = `
            color: var(--danger);
            font-size: 12px;
            margin-top: 4px;
            animation: slideDown 0.2s ease-out;
        `;
        
        field.parentNode.appendChild(error);
    }

    // Hide field error
    function hideFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    // Setup modal focus management
    function setupModalFocus() {
        const modals = document.querySelectorAll('.modal');
        
        modals.forEach(modal => {
            modal.addEventListener('show', () => {
                // Focus first input when modal opens
                const firstInput = modal.querySelector('input, select, textarea, button');
                if (firstInput) {
                    setTimeout(() => firstInput.focus(), 100);
                }
            });
        });
    }

    // Setup global event listeners
    function setupGlobalEventListeners(app) {
        // Handle window resize
        window.addEventListener('resize', window.Utils.debounce(() => {
            handleWindowResize(app);
        }, 250));
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('🙈 App hidden');
                // Pause any expensive operations
                pauseExpensiveOperations(app);
            } else {
                console.log('👁️ App visible');
                // Resume operations and refresh data
                resumeExpensiveOperations(app);
                refreshData(app);
            }
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            window.Utils.showNotification('🌐 Internetverbindung wiederhergestellt', 'success');
            updateConnectionStatus(true);
        });
        
        window.addEventListener('offline', () => {
            window.Utils.showNotification('📵 Keine Internetverbindung', 'warning');
            updateConnectionStatus(false);
        });
        
        // Handle focus/blur for accessibility
        window.addEventListener('blur', () => {
            document.body.classList.add('window-blurred');
        });
        
        window.addEventListener('focus', () => {
            document.body.classList.remove('window-blurred');
        });
        
        console.log('🌐 Global event listeners initialized');
    }

    // Handle window resize
    function handleWindowResize(app) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Responsive design breakpoints
        document.body.classList.toggle('compact-mode', width < 1000);
        document.body.classList.toggle('mobile-mode', width < 768);
        document.body.classList.toggle('low-height', height < 600);
        document.body.classList.toggle('very-low-height', height < 500);
        
        // Adjust panel sizes
        adjustPanelSizes(width, height);
        
        // Update resize handle position
        updateResizeHandlePosition();
        
        console.log(`📐 Window resized: ${width}x${height}`);
    }

    // Adjust panel sizes for different screen sizes
    function adjustPanelSizes(width, height) {
        const audioPanel = document.getElementById('audioPanel');
        const hotkeyPanel = document.getElementById('hotkeyPanel');
        
        if (width < 768) {
            // Mobile layout - stack vertically
            if (audioPanel) audioPanel.style.flex = '1';
            if (hotkeyPanel) hotkeyPanel.style.flex = '1';
        } else if (width < 1000) {
            // Tablet layout - narrow panels
            if (audioPanel) audioPanel.style.flex = '0 0 350px';
        }
    }

    // Update resize handle position
    function updateResizeHandlePosition() {
        const handle = document.getElementById('resizeHandle');
        const audioPanel = document.getElementById('audioPanel');
        
        if (handle && audioPanel) {
            const width = audioPanel.offsetWidth;
            handle.style.left = `${width}px`;
        }
    }

    // Pause expensive operations when app is hidden
    function pauseExpensiveOperations(app) {
        if (app.animationFrame) {
            cancelAnimationFrame(app.animationFrame);
            app.animationFrame = null;
        }
        
        // Pause level monitoring
        if (window.electronAPI && window.electronAPI.stopLevelMonitor) {
            window.electronAPI.stopLevelMonitor();
        }
    }

    // Resume expensive operations when app is visible
    function resumeExpensiveOperations(app) {
        // Resume VU meter animation
        if (window.AudioMixer && window.AudioMixer.startVUAnimation) {
            window.AudioMixer.startVUAnimation(app);
        }
        
        // Resume level monitoring
        if (window.electronAPI && window.electronAPI.startLevelMonitor) {
            window.electronAPI.startLevelMonitor();
        }
    }

    // Update connection status indicator
    function updateConnectionStatus(online) {
        const indicators = document.querySelectorAll('.connection-indicator');
        indicators.forEach(indicator => {
            indicator.classList.toggle('offline', !online);
        });
    }

    // Refresh data when app becomes visible
    async function refreshData(app) {
        try {
            // Refresh audio sources
            if (window.AudioMixer && window.AudioMixer.updateAudioSources) {
                await window.AudioMixer.updateAudioSources();
            }
            
            // Refresh MIDI devices
            if (window.MIDIController && window.MIDIController.updateDeviceList) {
                window.MIDIController.updateDeviceList(app);
            }
            
            // Refresh OBS scenes if connected
            if (window.OBSController && app.obsWebSocket && window.OBSController.isConnected(app)) {
                await window.OBSController.updateScenes(app);
            }
            
            console.log('🔄 Data refreshed');
            
        } catch (error) {
            console.error('❌ Failed to refresh data:', error);
        }
    }

    // Initialize tooltips
    function initTooltips() {
        const elements = document.querySelectorAll('[title]');
        
        elements.forEach(element => {
            let timeout;
            
            element.addEventListener('mouseenter', (e) => {
                timeout = setTimeout(() => {
                    showTooltip(e.target, e.target.getAttribute('title'));
                }, 1000);
            });
            
            element.addEventListener('mouseleave', () => {
                clearTimeout(timeout);
                hideTooltip();
            });
            
            element.addEventListener('click', () => {
                clearTimeout(timeout);
                hideTooltip();
            });
            
            // Don't show tooltips on touch devices
            element.addEventListener('touchstart', () => {
                clearTimeout(timeout);
            });
        });
        
        console.log('💡 Tooltips initialized');
    }

    // Show tooltip
    function showTooltip(element, text) {
        hideTooltip();
        
        currentTooltip = document.createElement('div');
        currentTooltip.className = 'tooltip';
        currentTooltip.textContent = text;
        currentTooltip.style.cssText = `
            position: fixed;
            background: var(--bg-panel);
            color: var(--text);
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            border: 1px solid var(--border);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            animation: fadeIn 0.2s ease-out;
        `;
        
        document.body.appendChild(currentTooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipRect = currentTooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 8;
        
        // Adjust if tooltip goes off screen
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        if (top < 8) {
            top = rect.bottom + 8;
        }
        
        currentTooltip.style.left = left + 'px';
        currentTooltip.style.top = top + 'px';
    }

    // Hide tooltip
    function hideTooltip() {
        if (currentTooltip) {
            currentTooltip.remove();
            currentTooltip = null;
        }
    }

    // Initialize responsive design
    function initResponsiveDesign(app) {
        // Set initial responsive classes
        handleWindowResize(app);
        
        // Setup media query listeners
        const mediaQueries = {
            mobile: window.matchMedia('(max-width: 768px)'),
            tablet: window.matchMedia('(max-width: 1000px)'),
            desktop: window.matchMedia('(min-width: 1001px)')
        };
        
        Object.entries(mediaQueries).forEach(([key, mq]) => {
            mq.addListener(() => handleMediaQueryChange(app, key, mq.matches));
        });
        
        console.log('📱 Responsive design initialized');
    }

    // Handle media query changes
    function handleMediaQueryChange(app, breakpoint, matches) {
        console.log(`📱 Breakpoint ${breakpoint}: ${matches ? 'active' : 'inactive'}`);
        
        switch (breakpoint) {
            case 'mobile':
                if (matches) {
                    enableMobileMode(app);
                } else {
                    disableMobileMode(app);
                }
                break;
            case 'tablet':
                if (matches) {
                    enableTabletMode(app);
                }
                break;
            case 'desktop':
                if (matches) {
                    enableDesktopMode(app);
                }
                break;
        }
    }

    // Enable mobile mode
    function enableMobileMode(app) {
        document.body.classList.add('mobile-mode');
        
        // Hide resize handle on mobile
        const handle = document.getElementById('resizeHandle');
        if (handle) handle.style.display = 'none';
        
        // Stack panels vertically
        const container = document.querySelector('.main-container');
        if (container) container.style.flexDirection = 'column';
    }

    // Disable mobile mode  
    function disableMobileMode(app) {
        document.body.classList.remove('mobile-mode');
        
        // Show resize handle
        const handle = document.getElementById('resizeHandle');
        if (handle) handle.style.display = 'block';
        
        // Restore horizontal layout
        const container = document.querySelector('.main-container');
        if (container) container.style.flexDirection = 'row';
    }

    // Enable tablet mode
    function enableTabletMode(app) {
        document.body.classList.add('tablet-mode');
        
        // Adjust panel widths for tablet
        const audioPanel = document.getElementById('audioPanel');
        if (audioPanel) audioPanel.style.flex = '0 0 350px';
    }

    // Enable desktop mode
    function enableDesktopMode(app) {
        document.body.classList.remove('tablet-mode', 'mobile-mode');
        
        // Restore saved panel width
        const savedWidth = window.Utils.getLocalStorage('audioPanelWidth');
        const audioPanel = document.getElementById('audioPanel');
        if (audioPanel && savedWidth) {
            audioPanel.style.flex = `0 0 ${savedWidth}px`;
        }
    }

    // Initialize keyboard shortcuts
    function initKeyboardShortcuts(app) {
        document.addEventListener('keydown', (e) => {
            handleKeyboardShortcut(app, e);
        });
        
        console.log('⌨️ Keyboard shortcuts initialized');
    }

    // Handle keyboard shortcuts
    function handleKeyboardShortcut(app, e) {
        // Don't handle shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;
        
        switch (e.key) {
            case 's':
                if (ctrl) {
                    e.preventDefault();
                    window.ConfigManager.saveConfig(app);
                    window.Utils.showNotification('Konfiguration gespeichert', 'success');
                }
                break;
                
            case 'a':
                if (ctrl && shift) {
                    e.preventDefault();
                    window.AudioMixer.addChannel(app);
                }
                break;
                
            case 'h':
                if (ctrl && shift) {
                    e.preventDefault();
                    window.HotkeyManager.addHotkey(app);
                }
                break;
                
            case ',':
                if (ctrl) {
                    e.preventDefault();
                    window.ConfigManager.openSettings(app);
                }
                break;
                
            case 'F1':
                e.preventDefault();
                showHelpDialog();
                break;
                
            case 'F11':
                e.preventDefault();
                toggleFullscreen();
                break;
                
            // Number keys for quick hotkey activation
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                if (alt) {
                    e.preventDefault();
                    triggerHotkeyByIndex(app, parseInt(e.key) - 1);
                }
                break;
        }
    }

    // Trigger hotkey by index
    function triggerHotkeyByIndex(app, index) {
        if (app.hotkeys && app.hotkeys[index]) {
            const hotkey = app.hotkeys[index];
            if (window.HotkeyManager) {
                window.HotkeyManager.executeHotkey(app, hotkey, 'press');
                window.Utils.showNotification(`Hotkey ausgelöst: ${hotkey.name}`, 'info');
            }
        }
    }

    // Show help dialog
    function showHelpDialog() {
        const helpContent = `
            <div style="max-width: 500px;">
                <h3 style="color: var(--secondary); margin-bottom: 15px;">Tastenkürzel</h3>
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px; font-size: 14px;">
                    <strong>Ctrl+S</strong><span>Konfiguration speichern</span>
                    <strong>Ctrl+Shift+A</strong><span>Audio-Kanal hinzufügen</span>
                    <strong>Ctrl+Shift+H</strong><span>Hotkey hinzufügen</span>
                    <strong>Ctrl+,</strong><span>Einstellungen öffnen</span>
                    <strong>Alt+1-9</strong><span>Hotkey 1-9 auslösen</span>
                    <strong>F1</strong><span>Diese Hilfe anzeigen</span>
                    <strong>F11</strong><span>Vollbild umschalten</span>
                    <strong>Escape</strong><span>Dialog schließen</span>
                </div>
                
                <h3 style="color: var(--secondary); margin: 20px 0 15px;">Maus-Steuerung</h3>
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px; font-size: 14px;">
                    <strong>Ziehen</strong><span>Elemente neu anordnen</span>
                    <strong>Rechtsklick</strong><span>Kontextmenü öffnen</span>
                    <strong>Doppelklick</strong><span>Element bearbeiten</span>
                </div>
            </div>
        `;
        
        showModal('Hilfe', helpContent);
    }

    // Toggle fullscreen
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // Initialize accessibility features
    function initAccessibility() {
        // Add ARIA labels and roles
        addAriaLabels();
        
        // Setup focus management
        setupFocusManagement();
        
        // Setup screen reader announcements
        setupScreenReaderAnnouncements();
        
        console.log('♿ Accessibility features initialized');
    }

    // Add ARIA labels and roles
    function addAriaLabels() {
        // Add labels to buttons without text
        const iconButtons = document.querySelectorAll('.icon-btn');
        iconButtons.forEach(btn => {
            if (!btn.hasAttribute('aria-label')) {
                const title = btn.getAttribute('title');
                if (title) {
                    btn.setAttribute('aria-label', title);
                }
            }
        });
        
        // Add roles to interactive elements
        const sliders = document.querySelectorAll('.volume-slider');
        sliders.forEach(slider => {
            slider.setAttribute('role', 'slider');
            slider.setAttribute('tabindex', '0');
        });
        
        // Add live regions for notifications
        const notificationArea = document.createElement('div');
        notificationArea.id = 'notification-aria';
        notificationArea.setAttribute('aria-live', 'polite');
        notificationArea.setAttribute('aria-atomic', 'true');
        notificationArea.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(notificationArea);
    }

    // Setup focus management
    function setupFocusManagement() {
        // Focus visible elements only
        document.addEventListener('focusin', (e) => {
            const element = e.target;
            
            // Skip focus on hidden elements
            if (element.offsetParent === null) {
                const nextFocusable = findNextFocusableElement(element);
                if (nextFocusable) {
                    nextFocusable.focus();
                }
            }
        });
        
        // Tab navigation improvements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                handleTabNavigation(e);
            }
        });
    }

    // Find next focusable element
    function findNextFocusableElement(current) {
        const focusableElements = document.querySelectorAll(
            'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const focusableArray = Array.from(focusableElements);
        const currentIndex = focusableArray.indexOf(current);
        
        return focusableArray[currentIndex + 1] || focusableArray[0];
    }

    // Handle tab navigation
    function handleTabNavigation(e) {
        const activeModal = document.querySelector('.modal.active');
        
        if (activeModal) {
            // Trap focus within modal
            const focusableElements = activeModal.querySelectorAll(
                'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    // Setup screen reader announcements
    function setupScreenReaderAnnouncements() {
        // Announce notifications to screen readers
        const originalShowNotification = window.Utils.showNotification;
        
        window.Utils.showNotification = function(message, type) {
            // Call original function
            originalShowNotification.call(this, message, type);
            
            // Announce to screen reader
            const ariaElement = document.getElementById('notification-aria');
            if (ariaElement) {
                ariaElement.textContent = `${type}: ${message}`;
            }
        };
    }

    // Show loading state
    function showLoading(message = 'Laden...', progress = null) {
        hideLoading();
        
        const loading = document.createElement('div');
        loading.id = 'loading-overlay';
        loading.setAttribute('role', 'dialog');
        loading.setAttribute('aria-label', 'Ladevorgang');
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        
        const progressBar = progress !== null ? 
            `<div style="width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 10px 0;">
                <div style="width: ${progress}%; height: 100%; background: var(--secondary); border-radius: 2px; transition: width 0.3s;"></div>
            </div>` : '';
        
        loading.innerHTML = `
            <div style="
                background: var(--primary);
                padding: 30px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid var(--border);
                min-width: 200px;
            ">
                <div style="
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--text-dim);
                    border-top: 3px solid var(--secondary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 15px;
                "></div>
                <div style="color: var(--text); font-size: 16px; margin-bottom: 10px;">${message}</div>
                ${progressBar}
            </div>
        `;
        
        document.body.appendChild(loading);
        
        // Focus the loading dialog for screen readers
        loading.focus();
    }

    // Update loading progress
    function updateLoadingProgress(progress, message) {
        const loading = document.getElementById('loading-overlay');
        if (!loading) return;
        
        const progressBar = loading.querySelector('[style*="width:"]');
        const messageElement = loading.querySelector('[style*="font-size: 16px"]');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (messageElement && message) {
            messageElement.textContent = message;
        }
    }

    // Hide loading state
    function hideLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.remove();
        }
    }

    // Show context menu
    function showContextMenu(e, items) {
        e.preventDefault();
        hideContextMenu();
        
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.setAttribute('role', 'menu');
        menu.style.cssText = `
            position: fixed;
            background: var(--primary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 4px 0;
            z-index: 2000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            min-width: 160px;
            animation: slideIn 0.15s ease-out;
        `;
        
        items.forEach((item, index) => {
            if (item === 'separator') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: var(--border);
                    margin: 4px 8px;
                `;
                menu.appendChild(separator);
                return;
            }
            
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.setAttribute('role', 'menuitem');
            menuItem.setAttribute('tabindex', item.disabled ? '-1' : '0');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                color: ${item.disabled ? 'var(--text-dim)' : 'var(--text)'};
                font-size: 14px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            if (item.icon) {
                menuItem.innerHTML = `${item.icon} ${item.label}`;
            }
            
            if (!item.disabled) {
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.background = 'var(--secondary)';
                    menuItem.style.color = 'var(--primary)';
                });
                
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.background = '';
                    menuItem.style.color = 'var(--text)';
                });
                
                menuItem.addEventListener('click', () => {
                    item.action();
                    hideContextMenu();
                });
                
                menuItem.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter' || ke.key === ' ') {
                        ke.preventDefault();
                        item.action();
                        hideContextMenu();
                    }
                });
            }
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Position menu
        positionContextMenu(menu, e.clientX, e.clientY);
        
        // Focus first item
        const firstItem = menu.querySelector('[tabindex="0"]');
        if (firstItem) {
            firstItem.focus();
        }
        
        // Close menu when clicking elsewhere or pressing Escape
        setTimeout(() => {
            document.addEventListener('click', hideContextMenu, { once: true });
            document.addEventListener('keydown', handleContextMenuKeyboard);
        }, 0);
    }

    // Position context menu
    function positionContextMenu(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        let left = x;
        let top = y;
        
        // Adjust if menu goes off screen
        if (left + rect.width > window.innerWidth) {
            left = window.innerWidth - rect.width - 8;
        }
        if (top + rect.height > window.innerHeight) {
            top = window.innerHeight - rect.height - 8;
        }
        
        // Ensure menu is not off-screen on the left or top
        left = Math.max(8, left);
        top = Math.max(8, top);
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    // Handle context menu keyboard navigation
    function handleContextMenuKeyboard(e) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        
        const items = menu.querySelectorAll('[role="menuitem"]:not([tabindex="-1"])');
        const currentIndex = Array.from(items).indexOf(document.activeElement);
        
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                hideContextMenu();
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % items.length;
                items[nextIndex].focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = (currentIndex - 1 + items.length) % items.length;
                items[prevIndex].focus();
                break;
        }
    }

    // Hide context menu
    function hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            document.removeEventListener('keydown', handleContextMenuKeyboard);
            menu.remove();
        }
    }

    // Show modal dialog
    function showModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');
        
        const defaultButtons = buttons.length > 0 ? buttons : [
            { text: 'OK', primary: true, action: () => hideModal(modal) }
        ];
        
        const buttonHtml = defaultButtons.map(btn => 
            `<button class="btn ${btn.primary ? 'btn-primary' : 'btn-secondary'}" onclick="(${btn.action})()">
                ${btn.text}
            </button>`
        ).join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3 id="modal-title" class="modal-header">${title}</h3>
                <div class="modal-body">${content}</div>
                <div class="button-group">
                    ${buttonHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus first button
        const firstButton = modal.querySelector('button');
        if (firstButton) {
            setTimeout(() => firstButton.focus(), 100);
        }
        
        return modal;
    }

    // Hide modal dialog
    function hideModal(modal) {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    }

    // Animate element in
    function animateIn(element, animation = 'slideUp') {
        if (!element) return;
        
        const animations = {
            slideUp: [
                { transform: 'translateY(20px)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ],
            slideDown: [
                { transform: 'translateY(-20px)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ],
            slideLeft: [
                { transform: 'translateX(20px)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 }
            ],
            slideRight: [
                { transform: 'translateX(-20px)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 }
            ],
            fadeIn: [
                { opacity: 0 },
                { opacity: 1 }
            ],
            scaleIn: [
                { transform: 'scale(0.8)', opacity: 0 },
                { transform: 'scale(1)', opacity: 1 }
            ],
            rotateIn: [
                { transform: 'rotate(-5deg) scale(0.8)', opacity: 0 },
                { transform: 'rotate(0deg) scale(1)', opacity: 1 }
            ]
        };
        
        return element.animate(animations[animation] || animations.slideUp, {
            duration: 300,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'forwards'
        });
    }

    // Animate element out
    function animateOut(element, animation = 'slideDown') {
        if (!element) return Promise.resolve();
        
        const animations = {
            slideDown: [
                { transform: 'translateY(0)', opacity: 1 },
                { transform: 'translateY(20px)', opacity: 0 }
            ],
            slideUp: [
                { transform: 'translateY(0)', opacity: 1 },
                { transform: 'translateY(-20px)', opacity: 0 }
            ],
            slideLeft: [
                { transform: 'translateX(0)', opacity: 1 },
                { transform: 'translateX(-20px)', opacity: 0 }
            ],
            slideRight: [
                { transform: 'translateX(0)', opacity: 1 },
                { transform: 'translateX(20px)', opacity: 0 }
            ],
            fadeOut: [
                { opacity: 1 },
                { opacity: 0 }
            ],
            scaleOut: [
                { transform: 'scale(1)', opacity: 1 },
                { transform: 'scale(0.8)', opacity: 0 }
            ],
            rotateOut: [
                { transform: 'rotate(0deg) scale(1)', opacity: 1 },
                { transform: 'rotate(5deg) scale(0.8)', opacity: 0 }
            ]
        };
        
        return element.animate(animations[animation] || animations.slideDown, {
            duration: 200,
            easing: 'ease-in',
            fill: 'both'
        }).finished;
    }

    // Update status bar
    function updateStatusBar(status) {
        let statusBar = document.getElementById('status-bar');
        
        if (!statusBar) {
            statusBar = document.createElement('div');
            statusBar.id = 'status-bar';
            statusBar.setAttribute('role', 'status');
            statusBar.setAttribute('aria-live', 'polite');
            statusBar.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 28px;
                background: var(--primary);
                border-top: 1px solid var(--border);
                display: flex;
                align-items: center;
                padding: 0 12px;
                font-size: 12px;
                color: var(--text-dim);
                z-index: 100;
            `;
            document.body.appendChild(statusBar);
            
            // Adjust main container to account for status bar
            const container = document.querySelector('.main-container');
            if (container) {
                container.style.height = 'calc(100vh - 88px)'; // Header + status bar
            }
        }
        
        const connectionItems = [
            { key: 'midi', label: 'MIDI', icon: status.midi ? '🎹' : '❌' },
            { key: 'obs', label: 'OBS', icon: status.obs ? '📹' : '❌' },
            { key: 'audio', label: 'Audio', icon: status.audio ? '🔊' : '🔇' }
        ];
        
        statusBar.innerHTML = `
            <span>${status.message || 'Bereit'}</span>
            <div style="margin-left: auto; display: flex; gap: 20px;">
                ${connectionItems.map(item => 
                    `<span title="${item.label}: ${status[item.key] ? 'Verbunden' : 'Getrennt'}">${item.icon} ${item.label}</span>`
                ).join('')}
                <span title="Version">${status.version || 'v1.0.0'}</span>
            </div>
        `;
    }

    // Performance monitoring
    function startPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        function measurePerformance() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                // Update performance indicator
                updatePerformanceIndicator(fps);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measurePerformance);
        }
        
        measurePerformance();
    }

    // Update performance indicator
    function updatePerformanceIndicator(fps) {
        let indicator = document.getElementById('performance-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'performance-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 70px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                color: var(--text);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                z-index: 999;
                display: none;
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `${fps} FPS`;
        indicator.style.color = fps < 30 ? 'var(--danger)' : fps < 50 ? 'var(--warning)' : 'var(--success)';
        
        // Show only in development mode
        if (process?.env?.NODE_ENV === 'development') {
            indicator.style.display = 'block';
        }
    }

    // Public API
    return {
        init,
        handleDragStart,
        handleDragEnd,
        showLoading,
        updateLoadingProgress,
        hideLoading,
        showContextMenu,
        hideContextMenu,
        showModal,
        hideModal,
        animateIn,
        animateOut,
        updateStatusBar,
        refreshData,
        showTooltip,
        hideTooltip,
        startPerformanceMonitoring,
        validateField,
        showFieldError,
        hideFieldError
    };
})();