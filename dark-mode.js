// Dark Mode Toggle Functionality
class DarkModeToggle {
    constructor() {
        this.themeToggle = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        // Apply saved theme on page load
        this.applyTheme(this.currentTheme);
        
        // Create toggle button
        this.createToggleButton();
        
        // Add event listener
        this.addEventListeners();
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
        document.documentElement.setAttribute('data-theme', theme);
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

// Initialize dark mode toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DarkModeToggle();
});

// Also initialize if DOM is already loaded (for dynamic content)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new DarkModeToggle();
    });
} else {
    new DarkModeToggle();
}
