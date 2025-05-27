// renderer/modules/utils.js
// Utility functions for the MIDI Controller App

window.Utils = (function() {
    
    // Show notification
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

    // Debounced function executor
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Clamp value between min and max
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Generate unique ID
    function generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    // Close modal
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
        
        // Reset MIDI learn mode
        if (window.APP_STATE) {
            window.APP_STATE.midiLearnMode = false;
            window.APP_STATE.midiLearnType = null;
            window.APP_STATE.currentEditIndex = -1;
            window.tempMidiCC = null;
            window.tempMidiNote = null;
        }
    }

    // Open modal
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Format time (for potential future use)
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Get element position relative to page
    function getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
    }

    // Animate element
    function animateElement(element, keyframes, options = {}) {
        if (element && element.animate) {
            return element.animate(keyframes, {
                duration: 300,
                easing: 'ease-out',
                ...options
            });
        }
        return null;
    }

    // Color utilities
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Local storage helpers (fallback for non-Electron environments)
    function getLocalStorage(key, defaultValue = null) {
        try {
            if (typeof Storage !== 'undefined') {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            }
        } catch (error) {
            console.warn('LocalStorage not available:', error);
        }
        return defaultValue;
    }

    function setLocalStorage(key, value) {
        try {
            if (typeof Storage !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            }
        } catch (error) {
            console.warn('LocalStorage not available:', error);
        }
        return false;
    }

    // Validate input
    function validateInput(value, type = 'string', options = {}) {
        switch (type) {
            case 'string':
                return typeof value === 'string' && value.length >= (options.minLength || 0);
            case 'number':
                const num = parseFloat(value);
                return !isNaN(num) && 
                       num >= (options.min || -Infinity) && 
                       num <= (options.max || Infinity);
            case 'integer':
                const int = parseInt(value);
                return Number.isInteger(int) && 
                       int >= (options.min || -Infinity) && 
                       int <= (options.max || Infinity);
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            default:
                return true;
        }
    }

    // File size formatter
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Deep clone object
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    // Check if object is empty
    function isEmpty(obj) {
        if (obj == null) return true;
        if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
        return Object.keys(obj).length === 0;
    }

    // Throttle function
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Public API
    return {
        showNotification,
        debounce,
        throttle,
        clamp,
        generateId,
        closeModal,
        openModal,
        formatTime,
        getElementPosition,
        animateElement,
        hexToRgb,
        rgbToHex,
        getLocalStorage,
        setLocalStorage,
        validateInput,
        formatFileSize,
        deepClone,
        isEmpty
    };
})();