// Dark Mode Toggle Functionality
class DarkModeToggle {
    constructor() {
        this.themeToggle = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        try {
            // Apply saved theme on page load
            this.applyTheme(this.currentTheme);
            
            // Create toggle button
            this.createToggleButton();
            
            // Add event listener
            this.addEventListeners();
            
            console.log('Dark mode initialized successfully');
        } catch (error) {
            console.error('Error initializing dark mode:', error);
        }
    }

    createToggleButton() {
        // Create toggle button element
        const toggleButton = document.createElement('button');
        toggleButton.id = 'theme-toggle';
        toggleButton.className = 'theme-toggle';
        toggleButton.innerHTML = `
            <i class="fas fa-moon" id="theme-icon"></i>
            <span id="theme-text">Dark Mode</span>
        `;
        
        // Add styles for the toggle button
        const style = document.createElement('style');
        style.textContent = `
            .theme-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 1002;
                background: var(--btn-primary);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 50px;
                height: 50px;
                box-shadow: 0 4px 12px var(--btn-shadow);
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .theme-toggle:hover {
                background: var(--btn-hover);
                transform: translateY(-2px) scale(1.05);
                box-shadow: 0 6px 16px var(--btn-shadow);
            }
            
            .theme-toggle:active {
                transform: translateY(0) scale(0.95);
            }
            
            .theme-toggle i {
                font-size: 18px;
                transition: transform 0.3s ease;
            }
            
            .theme-toggle:hover i {
                transform: rotate(15deg);
            }
            
            .theme-toggle span {
                display: none;
            }
            
            @media (max-width: 768px) {
                .theme-toggle {
                    bottom: 15px;
                    right: 15px;
                    width: 45px;
                    height: 45px;
                    font-size: 14px;
                }
                
                .theme-toggle i {
                    font-size: 16px;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(toggleButton);
        this.themeToggle = toggleButton;
    }

    addEventListeners() {
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme(this.currentTheme);
        this.updateToggleButton();
    }

    applyTheme(theme) {
        try {
            document.documentElement.setAttribute('data-theme', theme);
            document.body.setAttribute('data-theme', theme);
            console.log('Theme applied:', theme);
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    updateToggleButton() {
        const icon = document.getElementById('theme-icon');
        const text = document.getElementById('theme-text');
        
        if (this.currentTheme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Dark Mode';
        }
    }
}

// Initialize dark mode toggle
function initDarkMode() {
    // Check if already initialized
    if (document.getElementById('theme-toggle')) {
        return;
    }
    new DarkModeToggle();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
    // DOM is already loaded
    initDarkMode();
}

// Also initialize after a short delay to ensure everything is loaded
setTimeout(initDarkMode, 100);

// Fallback initialization
window.addEventListener('load', function() {
    if (!document.getElementById('theme-toggle')) {
        console.log('Fallback dark mode initialization');
        initDarkMode();
        
        // Show fallback button if main toggle still doesn't exist
        setTimeout(() => {
            if (!document.getElementById('theme-toggle')) {
                const fallbackBtn = document.getElementById('fallback-dark-mode');
                if (fallbackBtn) {
                    fallbackBtn.style.display = 'block';
                    console.log('Showing fallback dark mode button');
                }
            }
        }, 1000);
    }
});

// Simple fallback dark mode toggle
window.toggleDarkMode = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    console.log('Theme toggled to:', newTheme);
};
