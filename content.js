class DualSubtitles {
    constructor() {
        this.originalSubtitles = null;
        this.translatedSubtitles = null;
        this.videoPlayer = null;
        this.settings = {
            originalColor: '#ffd700',
            translatedColor: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            fontSize: 16,
            fontFamily: "'Work Sans', system-ui, arial",
            primaryLanguage: 'en',
            secondaryLanguage: 'tr',
            showSecondarySubtitle: true
        };
        this.subtitleUrls = {
            original: null,
            translated: null
        };
        this.settingsPanel = null;
        this.loadSettings();
        this.init();
        this.loadSubtitles();
        this.createSubtitleContainer();
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('dualSubtitlesSettings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
    }

    saveSettings() {
        localStorage.setItem('dualSubtitlesSettings', JSON.stringify(this.settings));
        this.applySettings();
    }

    applySettings() {
        if (this.originalSubtitleDiv && this.translatedSubtitleDiv) {
            this.originalSubtitleDiv.style.cssText = `
                color: ${this.settings.originalColor};
                font-size: ${this.settings.fontSize}px;
                font-family: ${this.settings.fontFamily};
                text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
                background-color: ${this.settings.backgroundColor};
                padding: 5px 10px;
                border-radius: 4px;
                margin-bottom: 5px;
            `;

            this.translatedSubtitleDiv.style.cssText = `
                color: ${this.settings.translatedColor};
                font-size: ${this.settings.fontSize}px;
                font-family: ${this.settings.fontFamily};
                text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
                background-color: ${this.settings.backgroundColor};
                padding: 5px 10px;
                border-radius: 4px;
            `;
        }
    }

    init() {
        const controlBarObserver = new MutationObserver(() => {
            const controlBars = document.querySelectorAll('.theo-secondary-color.vjs-control-bar');
            if (controlBars.length >= 2 && !document.querySelector('.subtitle-settings-btn')) {
                this.createSettingsButton();
            }
        });

        controlBarObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.createSettingsButton();
        this.applySettings();
    }

    async loadSubtitles() {
        try {
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (!nextDataScript) return;

            const data = JSON.parse(nextDataScript.textContent);
            const subtitles = data.props.pageProps.playerConfig.media.subtitles;
            
            subtitles.forEach(sub => {
                if (sub.code === this.settings.primaryLanguage) {
                    this.subtitleUrls.original = sub.src;
                } else if (sub.code === this.settings.secondaryLanguage) {
                    this.subtitleUrls.translated = sub.src;
                }
            });

            if (this.subtitleUrls.original && this.subtitleUrls.translated) {
                const [originalResponse, translatedResponse] = await Promise.all([
                    fetch(this.subtitleUrls.original),
                    fetch(this.subtitleUrls.translated)
                ]);

                const [originalText, translatedText] = await Promise.all([
                    originalResponse.text(),
                    translatedResponse.text()
                ]);

                this.originalSubtitles = this.parseVTT(originalText);
                this.translatedSubtitles = this.parseVTT(translatedText);
                this.startShowingSubtitles();
            }

            this.updateSubtitleVisibility();
        } catch (error) {
            console.error('Altyazı yüklenirken hata:', error);
        }
    }

    parseVTT(vttText) {
        const lines = vttText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
        
        function convertTimeToMilliseconds(minutes, seconds, milliseconds) {
            return parseInt(minutes) * 60000 + parseInt(seconds) * 1000 + parseInt(milliseconds);
        }

        const subtitles = [];
        let i = 0;

        while (i < lines.length) {
            const timeRegex = /^(\d{2}):(\d{2})\.(\d{3})\s-->\s(\d{2}):(\d{2})\.(\d{3})$/;
            const timeMatch = lines[i].match(timeRegex);

            if (timeMatch) {
                const start = convertTimeToMilliseconds(timeMatch[1], timeMatch[2], timeMatch[3]);
                const end = convertTimeToMilliseconds(timeMatch[4], timeMatch[5], timeMatch[6]);

                let text = "";
                i++;

                while (i < lines.length && !lines[i].match(timeRegex)) {
                    text += (text ? " " : "") + lines[i];
                    i++;
                }

                subtitles.push({ start, end, text });
            } else {
                i++;
            }
        }

        return subtitles;
    }

    startShowingSubtitles() {
        const checkVideo = setInterval(() => {
            const video = document.querySelector('video');
            if (video) {
                clearInterval(checkVideo);
                this.videoPlayer = video;
                video.addEventListener('timeupdate', () => {
                    const currentTimeMs = video.currentTime * 1000;
                    this.updateSubtitles(currentTimeMs);
                });
            }
        }, 1000);
    }

    updateSubtitles(currentTime) {
        if (!this.originalSubtitleDiv || !this.translatedSubtitleDiv) {
            console.error('Altyazı div\'leri bulunamadı');
            return;
        }

        const originalSubtitle = this.findCurrentSubtitle(this.originalSubtitles, currentTime);
        const translatedSubtitle = this.findCurrentSubtitle(this.translatedSubtitles, currentTime);

        // Birincil altyazı container'ı
        const originalContainer = this.originalSubtitleDiv.closest('.subtitle-container');
        if (originalContainer) {
            if (originalSubtitle) {
                originalContainer.style.display = 'block';
                this.originalSubtitleDiv.textContent = originalSubtitle.text;
            } else {
                originalContainer.style.display = 'none';
                this.originalSubtitleDiv.textContent = '';
            }
        }

        // İkincil altyazı container'ı
        const translatedContainer = this.translatedSubtitleDiv.closest('.subtitle-container');
        if (translatedContainer) {
            if (translatedSubtitle && this.settings.showSecondarySubtitle) {
                translatedContainer.style.display = 'block';
                this.translatedSubtitleDiv.textContent = translatedSubtitle.text;
            } else {
                translatedContainer.style.display = 'none';
                this.translatedSubtitleDiv.textContent = '';
            }
        }
    }

    findCurrentSubtitle(subtitles, currentTime) {
        return subtitles?.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    }

    createSubtitleContainer() {
        // Orijinal altyazı container'ı
        this.originalSubtitleDiv = document.createElement('div');
        this.originalSubtitleDiv.id = 'original-subtitle-container';
        this.originalSubtitleDiv.className = 'subtitle-container';
        this.originalSubtitleDiv.style.cssText = `
            position: fixed;
            bottom: 160px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            text-align: center;
            width: 80%;
            max-width: 800px;
        `;

        // Orijinal altyazı metni
        const originalText = document.createElement('div');
        originalText.id = 'original-subtitle';
        originalText.style.cssText = `
            color: ${this.settings.originalColor};
            font-size: ${this.settings.fontSize}px;
            text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
            background-color: ${this.settings.backgroundColor};
            padding: 5px 10px;
            border-radius: 4px;
            margin-bottom: 5px;
        `;

        // Orijinal altyazı için tutacak
        const originalHandle = document.createElement('div');
        originalHandle.className = 'subtitle-drag-handle';
        originalHandle.style.cssText = `
            width: 50px;
            height: 5px;
            background-color: rgba(255, 255, 255, 0.5);
            margin: 5px auto;
            border-radius: 2.5px;
            cursor: move;
        `;

        // Çeviri altyazı container'ı
        this.translatedSubtitleDiv = document.createElement('div');
        this.translatedSubtitleDiv.id = 'translated-subtitle-container';
        this.translatedSubtitleDiv.className = 'subtitle-container';
        this.translatedSubtitleDiv.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            text-align: center;
            width: 80%;
            max-width: 800px;
        `;

        // Çeviri altyazı metni
        const translatedText = document.createElement('div');
        translatedText.id = 'translated-subtitle';
        translatedText.style.cssText = `
            color: ${this.settings.translatedColor};
            font-size: ${this.settings.fontSize}px;
            text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
            background-color: ${this.settings.backgroundColor};
            padding: 5px 10px;
            border-radius: 4px;
        `;

        // Çeviri altyazı için tutacak
        const translatedHandle = document.createElement('div');
        translatedHandle.className = 'subtitle-drag-handle';
        translatedHandle.style.cssText = `
            width: 50px;
            height: 5px;
            background-color: rgba(255, 255, 255, 0.5);
            margin: 5px auto;
            border-radius: 2.5px;
            cursor: move;
        `;

        // Elementleri birleştir
        this.originalSubtitleDiv.appendChild(originalText);
        this.originalSubtitleDiv.appendChild(originalHandle);
        this.translatedSubtitleDiv.appendChild(translatedText);
        this.translatedSubtitleDiv.appendChild(translatedHandle);

        // Container'ları sayfaya ekle
        document.body.appendChild(this.originalSubtitleDiv);
        document.body.appendChild(this.translatedSubtitleDiv);

        // Sürükleme işleyicilerini ekle
        this.initDragHandlers(this.originalSubtitleDiv);
        this.initDragHandlers(this.translatedSubtitleDiv);

        // Referansları güncelle
        this.originalSubtitleDiv = originalText;
        this.translatedSubtitleDiv = translatedText;
    }

    initDragHandlers(container) {
        const dragHandle = container.querySelector('.subtitle-drag-handle');
        let isDragging = false;
        let startY = 0;
        let startBottom = 0;

        dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startBottom = parseInt(getComputedStyle(container).bottom);
            container.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaY = startY - e.clientY;
            const newBottom = startBottom + deltaY;
            
            // Alt ve üst sınırları kontrol et
            const maxBottom = window.innerHeight - 50;
            const minBottom = 50;
            
            if (newBottom >= minBottom && newBottom <= maxBottom) {
                container.style.bottom = `${newBottom}px`;
                // Pozisyonu kaydet
                localStorage.setItem(`${container.id}-position`, newBottom);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('dragging');
            }
        });

        // Kaydedilmiş pozisyonu yükle
        const savedPosition = localStorage.getItem(`${container.id}-position`);
        if (savedPosition) {
            container.style.bottom = `${savedPosition}px`;
        }
    }

    // İkincil altyazı görünürlüğünü güncelle
    updateSubtitleVisibility() {
        if (this.translatedSubtitleDiv) {
            const container = this.translatedSubtitleDiv.closest('.subtitle-container');
            if (container) {
                container.style.display = this.settings.showSecondarySubtitle ? 'block' : 'none';
            }
        }
    }

    createSettingsButton() {
        const controlBars = document.querySelectorAll('.theo-secondary-color.vjs-control-bar');
        const controlBar = controlBars[1];
        if (!controlBar) return;

        const settingsButton = document.createElement('button');
        settingsButton.className = 'theo-button vjs-control subtitle-settings-btn';
        settingsButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
        `;

        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSettingsPanel();
        });

        controlBar.appendChild(settingsButton);
    }

    showSettingsPanel() {
        // Panel zaten açıksa kapat
        if (this.settingsPanel) {
            this.settingsPanel.remove();
            this.settingsPanel = null;
            return;
        }

        // Theo player wrapper'ı bul
        const playerWrapper = document.querySelector('.theo-player-wrapper');
        if (!playerWrapper) {
            console.error('Player wrapper bulunamadı');
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'subtitle-settings-panel';
        panel.innerHTML = `
            <div class="settings-header">
                <h3>Altyazı Ayarları</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="setting-item">
                <label>Birincil Altyazı Dili</label>
                <select id="primaryLanguage">
                    <option value="en" ${this.settings.primaryLanguage === 'en' ? 'selected' : ''}>İngilizce</option>
                    <option value="tr" ${this.settings.primaryLanguage === 'tr' ? 'selected' : ''}>Türkçe</option>
                </select>
            </div>
            <div class="setting-item">
                <label>Birincil Altyazı Rengi</label>
                <input type="color" id="originalColor" value="${this.settings.originalColor}">
            </div>
            <div class="setting-item">
                <label>İkincil Altyazı Dili</label>
                <select id="secondaryLanguage">
                    <option value="tr" ${this.settings.secondaryLanguage === 'tr' ? 'selected' : ''}>Türkçe</option>
                    <option value="en" ${this.settings.secondaryLanguage === 'en' ? 'selected' : ''}>İngilizce</option>
                </select>
            </div>
            <div class="setting-item">
                <label>İkincil Altyazı Rengi</label>
                <input type="color" id="translatedColor" value="${this.settings.translatedColor}">
            </div>
            <div class="setting-item">
                <label class="checkbox-label">
                    <input type="checkbox" id="showSecondarySubtitle" ${this.settings.showSecondarySubtitle ? 'checked' : ''}>
                    İkincil Altyazıyı Göster
                </label>
            </div>
            <div class="setting-item">
                <label>Arka Plan Rengi</label>
                <input type="color" id="bgColor" value="#000000">
            </div>
            <div class="setting-item">
                <label>Arka Plan Saydamlığı: <span id="opacityValue">70%</span></label>
                <input type="range" id="opacity" min="0" max="100" value="70">
            </div>
            <div class="setting-item">
                <label>Yazı Boyutu: <span id="fontSizeValue">${this.settings.fontSize}px</span></label>
                <input type="range" id="fontSize" min="12" max="32" value="${this.settings.fontSize}">
            </div>
            <div class="setting-item">
                <label>Yazı Tipi</label>
                <select id="fontFamily">
                    <option value="'Work Sans', system-ui, arial" selected>Work Sans</option>
                    <option value="system-ui, arial">Sistem Fontu</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Segoe UI', sans-serif">Segoe UI</option>
                    <option value="'SF Pro Text', sans-serif">SF Pro</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                </select>
            </div>
        `;

        // Event listeners ekle
        const opacityInput = panel.querySelector('#opacity');
        const bgColorInput = panel.querySelector('#bgColor');
        const fontFamilySelect = panel.querySelector('#fontFamily');
        const fontSizeInput = panel.querySelector('#fontSize');
        const primaryLangSelect = panel.querySelector('#primaryLanguage');
        const secondaryLangSelect = panel.querySelector('#secondaryLanguage');
        const showSecondaryCheckbox = panel.querySelector('#showSecondarySubtitle');
        const originalColorInput = panel.querySelector('#originalColor');
        const translatedColorInput = panel.querySelector('#translatedColor');

        // Yazı boyutu değiştiğinde
        fontSizeInput.addEventListener('input', (e) => {
            const newSize = parseInt(e.target.value);
            this.settings.fontSize = newSize;
            panel.querySelector('#fontSizeValue').textContent = `${newSize}px`;
            this.saveSettings();
            this.applySettings();
        });

        // Opaklık değiştiğinde
        opacityInput.addEventListener('input', (e) => {
            const opacity = e.target.value / 100;
            const rgb = this.hexToRgb(bgColorInput.value);
            this.settings.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            panel.querySelector('#opacityValue').textContent = `${e.target.value}%`;
            this.saveSettings();
        });

        // Arka plan rengi değiştiğinde
        bgColorInput.addEventListener('input', (e) => {
            const rgb = this.hexToRgb(e.target.value);
            const opacity = opacityInput.value / 100;
            this.settings.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            this.saveSettings();
        });

        // Font ailesi değiştiğinde
        fontFamilySelect.addEventListener('change', (e) => {
            this.settings.fontFamily = e.target.value;
            this.saveSettings();
            this.applySettings();
        });

        // Dillerin değiştiğinde
        primaryLangSelect.addEventListener('change', (e) => {
            const newPrimaryLang = e.target.value;
            const currentSecondaryLang = this.settings.secondaryLanguage;
            
            // Dillerin aynı olmasını engelle
            if (newPrimaryLang === currentSecondaryLang) {
                this.settings.secondaryLanguage = newPrimaryLang === 'en' ? 'tr' : 'en';
                secondaryLangSelect.value = this.settings.secondaryLanguage;
            }
            
            this.settings.primaryLanguage = newPrimaryLang;
            this.saveSettings();
            this.loadSubtitles(); // Altyazıları yeniden yükle
        });

        secondaryLangSelect.addEventListener('change', (e) => {
            const newSecondaryLang = e.target.value;
            const currentPrimaryLang = this.settings.primaryLanguage;
            
            // Dillerin aynı olmasını engelle
            if (newSecondaryLang === currentPrimaryLang) {
                this.settings.primaryLanguage = newSecondaryLang === 'en' ? 'tr' : 'en';
                primaryLangSelect.value = this.settings.primaryLanguage;
            }
            
            this.settings.secondaryLanguage = newSecondaryLang;
            this.saveSettings();
            this.loadSubtitles(); // Altyazıları yeniden yükle
        });

        showSecondaryCheckbox.addEventListener('change', (e) => {
            this.settings.showSecondarySubtitle = e.target.checked;
            this.saveSettings();
            this.updateSubtitleVisibility();
        });

        // Renk değişikliklerini dinle
        originalColorInput.addEventListener('input', (e) => {
            this.settings.originalColor = e.target.value;
            this.saveSettings();
            this.applySettings();
        });

        translatedColorInput.addEventListener('input', (e) => {
            this.settings.translatedColor = e.target.value;
            this.saveSettings();
            this.applySettings();
        });

        // Panel kapatma fonksiyonu
        const closePanel = () => {
            if (this.settingsPanel) {
                this.settingsPanel.remove();
                this.settingsPanel = null;
            }
        };

        // Kapat butonunu aktifleştir
        const closeBtn = panel.querySelector('.close-btn');
        closeBtn.addEventListener('click', closePanel);

        // Panel'i player wrapper'a ekle
        playerWrapper.appendChild(panel);
        this.settingsPanel = panel;

        // Panel dışına tıklamayı dinle
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.subtitle-settings-btn') && !panel.contains(e.target)) {
                if (this.settingsPanel) {
                    this.settingsPanel.remove();
                    this.settingsPanel = null;
                }
                document.removeEventListener('click', handleOutsideClick);
            }
        };

        // Click event'ini bir sonraki tick'te ekle
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);
    }

    // Hex renk kodunu RGB'ye çeviren yardımcı fonksiyon
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// Sayfa yüklendiğinde başlat
const initExtension = () => {
    new DualSubtitles();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
} 