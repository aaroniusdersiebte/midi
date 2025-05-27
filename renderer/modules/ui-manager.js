// renderer/modules/ui-manager.js
// User Interface management and interactions

window.UIManager = (function() {
    
    let draggedElement = null;
    let draggedType = null;
    let draggedIndex = -1;
    
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
        }
        
        if (hotkeyContainer) {
            hotkeyContainer.addEventListener('dragover', handleDragOver);
            hotkeyContainer.addEventListener('drop', (e) => handleDrop(app, e, 'hotkey'));
        }
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
        
        console.log(`🔄 Drag started: ${type} #${index}`);
    }

    // Handle drag end
    function handleDragEnd(e) {
        e.target.style.opacity = '';
        e.target.classList.remove('dragging');
        
        // Clean up drag indicators
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        draggedElement = null;
        draggedType = null;
        draggedIndex = -1;
    }

    // Handle drag over
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        
        e.dataTransfer.dropEffect = 'move';
        
        // Add visual feedback
        const target = e.currentTarget;
        target.classList.add('drag-over');
        
        // Remove drag-over class after a short delay
        setTimeout(() => {
            target.classList.remove('drag-over');
        }, 100);
        
        return false;
    }

    // Handle drop
    function handleDrop(app, e, targetType) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        if (!draggedElement || draggedIndex < 0 || draggedType !== targetType) {
            return false;
        }
        
        const dropIndex = getDropIndex(e.currentTarget, e.clientY);
        
        if (draggedType === 'audio') {
            // Reorder audio channels
            const [removed] = app.audioChannels.splice(draggedIndex, 1);
            app.audioChannels.splice(dropIndex, 0, removed);
            
            window.ConfigManager.saveConfig(app);
            window.AudioMixer.renderChannels(app);
            
            window.Utils.showNotification(`Audio-Kanal verschoben`, 'info');
            
        } else if (draggedType === 'hotkey') {
            // Reorder hotkeys
            const [removed] = app.hotkeys.splice(draggedIndex, 1);
            app.hotkeys.splice(dropIndex, 0, removed);
            
            window.ConfigManager.saveConfig(app);
            window.HotkeyManager.renderHotkeys(app);
            
            window.Utils.showNotification(`Hotkey verschoben`, 'info');
        }
        
        return false;
    }

    // Get drop index based on mouse position
    function getDropIndex(container, y) {
        const elements = [...container.children].filter(el => !el.classList.contains('dragging'));
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
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                handle.classList.remove('active');
                
                console.log('📏 Panel resize completed');
            }
        });
        
        // Set initial position
        setTimeout(() => {
            const savedWidth = window.Utils.getLocalStorage('audioPanelWidth');
            if (savedWidth) {
                audioPanel.style.flex = `0 0 ${savedWidth}px`;
                handle.style.left = `${savedWidth}px`;
            } else {
                const audioWidth = audioPanel.offsetWidth;
                handle.style.left = `${audioWidth}px`;
            }
        }, 100);
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
            }
        });
        
        // Setup form validation
        setupFormValidation();
    }

    // Setup form validation
    function setupFormValidation() {
        // Real-time validation for audio channel name
        const audioNameInput = document.getElementById('audioName');
        if (audioNameInput) {
            audioNameInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                const isValid = value.length >= 1 && value.length <= 50;
                
                e.target.classList.toggle('invalid', !isValid);
                
                if (!isValid && value.length > 0) {
                    showFieldError(e.target, 'Name muss zwischen 1 und 50 Zeichen lang sein');
                } else {
                    hideFieldError(e.target);
                }
            });
        }
        
        // Real-time validation for hotkey name
        const hotkeyNameInput = document.getElementById('hotkeyName');
        if (hotkeyNameInput) {
            hotkeyNameInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                const isValid = value.length >= 1 && value.length <= 30;
                
                e.target.classList.toggle('invalid', !isValid);
                
                if (!isValid && value.length > 0) {
                    showFieldError(e.target, 'Name muss zwischen 1 und 30 Zeichen lang sein');
                } else {
                    hideFieldError(e.target);
                }
            });
        }
    }

    // Show field error
    function showFieldError(field, message) {
        hideFieldError(field);
        
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        error.style.color = 'var(--danger)';
        error.style.fontSize = '12px';
        error.style.marginTop = '4px';
        
        field.parentNode.appendChild(error);
    }

    // Hide field error
    function hideFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
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
            } else {
                console.log('👁️ App visible');
                // Refresh data when app becomes visible
                refreshData(app);
            }
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            window.Utils.showNotification('🌐 Internetverbindung wiederhergestellt', 'success');
        });
        
        window.addEventListener('offline', () => {
            window.Utils.showNotification('📵 Keine Internetverbindung', 'warning');
        });
    }

    // Handle window resize
    function handleWindowResize(app) {
        // Adjust layout for small screens
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (width < 800) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
        
        if (height < 600) {
            document.body.classList.add('low-height');
        } else {
            document.body.classList.remove('low-height');
        }
        
        console.log(`📐 Window resized: ${width}x${height}`);
    }

    // Refresh data
    async function refreshData(app) {
        try {
            // Refresh audio sources
            if (window.AudioMixer) {
                await window.AudioMixer.updateAudioSources();
            }
            
            // Refresh MIDI devices
            if (window.MIDIController) {
                window.MIDIController.updateDeviceList(app);
            }
            
            // Refresh OBS scenes if connected
            if (window.OBSController && app.obsWebSocket) {
                await window.OBSController.updateScenes(app);
            }
            
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }

    // Initialize tooltips
    function initTooltips() {
        const elements = document.querySelectorAll('[title]');
        
        elements.forEach(element => {
            let timeout;
            let tooltip;
            
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
        });
        
        function showTooltip(element, text) {
            hideTooltip();
            
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = text;
            tooltip.style.cssText = `
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
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 8;
            
            // Adjust if tooltip goes off screen
            if (left < 0) left = 8;
            if (left + tooltipRect.width > window.innerWidth) {
                left = window.innerWidth - tooltipRect.width - 8;
            }
            if (top < 0) {
                top = rect.bottom + 8;
            }
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
        
        function hideTooltip() {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        }
    }

    // Show loading state
    function showLoading(message = 'Laden...') {
        hideLoading();
        
        const loading = document.createElement('div');
        loading.id = 'loading-overlay';
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
        
        loading.innerHTML = `
            <div style="
                background: var(--primary);
                padding: 20px 30px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid var(--border);
            ">
                <div style="
                    width: 24px;
                    height: 24px;
                    border: 2px solid var(--secondary);
                    border-top: 2px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px;
                "></div>
                <div style="color: var(--text);">${message}</div>
            </div>
        `;
        
        document.body.appendChild(loading);
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
        menu.style.cssText = `
            position: fixed;
            background: var(--primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 4px 0;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 150px;
        `;
        
        items.forEach(item => {
            if (item === 'separator') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: var(--border);
                    margin: 4px 0;
                `;
                menu.appendChild(separator);
                return;
            }
            
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: var(--text);
                font-size: 14px;
                transition: background 0.2s;
            `;
            
            if (item.disabled) {
                menuItem.style.opacity = '0.5';
                menuItem.style.cursor = 'not-allowed';
            } else {
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
            }
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Position menu
        const rect = menu.getBoundingClientRect();
        let left = e.clientX;
        let top = e.clientY;
        
        if (left + rect.width > window.innerWidth) {
            left = window.innerWidth - rect.width - 8;
        }
        if (top + rect.height > window.innerHeight) {
            top = window.innerHeight - rect.height - 8;
        }
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', hideContextMenu, { once: true });
        }, 0);
    }

    // Hide context menu
    function hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.remove();
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
            fadeIn: [
                { opacity: 0 },
                { opacity: 1 }
            ],
            scaleIn: [
                { transform: 'scale(0.8)', opacity: 0 },
                { transform: 'scale(1)', opacity: 1 }
            ]
        };
        
        element.animate(animations[animation] || animations.slideUp, {
            duration: 300,
            easing: 'ease-out',
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
            fadeOut: [
                { opacity: 1 },
                { opacity: 0 }
            ],
            scaleOut: [
                { transform: 'scale(1)', opacity: 1 },
                { transform: 'scale(0.8)', opacity: 0 }
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
            statusBar.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 24px;
                background: var(--primary);
                border-top: 1px solid var(--border);
                display: flex;
                align-items: center;
                padding: 0 10px;
                font-size: 12px;
                color: var(--text-dim);
                z-index: 100;
            `;
            document.body.appendChild(statusBar);
        }
        
        statusBar.innerHTML = `
            <span>${status.message}</span>
            <div style="margin-left: auto; display: flex; gap: 15px;">
                <span>MIDI: ${status.midi ? '🎹' : '❌'}</span>
                <span>OBS: ${status.obs ? '📹' : '❌'}</span>
                <span>Audio: ${status.audio ? '🔊' : '🔇'}</span>
            </div>
        `;
    }

    // Public API
    return {
        init,
        handleDragStart,
        handleDragEnd,
        showLoading,
        hideLoading,
        showContextMenu,
        hideContextMenu,
        animateIn,
        animateOut,
        updateStatusBar,
        refreshData
    };
})();