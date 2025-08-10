class ParameterManager {
    constructor() {
        this.parameters = {};
        this.subscribers = new Map();
        this.initializeParameters();
        this.setupEventListeners();
    }

    initializeParameters() {
        const paramInputs = document.querySelectorAll('.parameter-panel input, .parameter-panel select');
        paramInputs.forEach(input => {
            this.parameters[input.name || input.id] = input.value;
            
            input.addEventListener('input', (e) => {
                this.updateParameter(e.target.name || e.target.id, e.target.value);
            });
        });
    }

    updateParameter(key, value) {
        const oldValue = this.parameters[key];
        this.parameters[key] = value;
        
        this.notifySubscribers(key, value, oldValue);
        
        this.saveToLocalStorage();
        this.updateURLParams();
    }

    getParameter(key) {
        return this.parameters[key];
    }

    getAllParameters() {
        return { ...this.parameters };
    }

    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        this.subscribers.get(key).push(callback);
    }

    notifySubscribers(key, newValue, oldValue) {
        if (this.subscribers.has(key)) {
            this.subscribers.get(key).forEach(callback => {
                callback(newValue, oldValue, key);
            });
        }
        
        if (this.subscribers.has('*')) {
            this.subscribers.get('*').forEach(callback => {
                callback(this.getAllParameters(), key);
            });
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('ntn-satellite-params', JSON.stringify(this.parameters));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('ntn-satellite-params');
        if (saved) {
            const params = JSON.parse(saved);
            Object.keys(params).forEach(key => {
                const input = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (input) {
                    input.value = params[key];
                    this.parameters[key] = params[key];
                }
            });
        }
    }

    loadFromURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.forEach((value, key) => {
            const input = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value;
                this.parameters[key] = value;
            }
        });
    }

    updateURLParams() {
        const url = new URL(window.location);
        Object.keys(this.parameters).forEach(key => {
            if (this.parameters[key]) {
                url.searchParams.set(key, this.parameters[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url);
    }

    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            this.saveToLocalStorage();
        });

        window.addEventListener('load', () => {
            this.loadFromURLParams();
            this.loadFromLocalStorage();
        });
    }
}

class PageManager {
    constructor(paramManager) {
        this.paramManager = paramManager;
        this.currentPage = 'dashboard';
        this.pages = {};
        this.initializeNavigation();
        this.initializePages();
    }

    initializeNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pageName = e.target.dataset.page;
                this.switchPage(pageName);
            });
        });
    }

    initializePages() {
        this.pages.dashboard = new Dashboard(this.paramManager);
        this.pages['satellite-config'] = new SatelliteConfig(this.paramManager);
        this.pages['network-analysis'] = new NetworkAnalysis(this.paramManager);
        this.pages.monitoring = new Monitoring(this.paramManager);
    }

    switchPage(pageName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageName).classList.add('active');

        if (this.pages[this.currentPage]) {
            this.pages[this.currentPage].onPageExit();
        }

        this.currentPage = pageName;
        
        if (this.pages[pageName]) {
            this.pages[pageName].onPageEnter();
        }
    }
}

class BasePage {
    constructor(paramManager) {
        this.paramManager = paramManager;
        this.setupParameterSubscriptions();
    }

    setupParameterSubscriptions() {
        this.paramManager.subscribe('*', (params) => {
            this.onParametersChanged(params);
        });
    }

    onPageEnter() {
        this.refresh();
    }

    onPageExit() {
    }

    onParametersChanged(params) {
    }

    refresh() {
    }

    updateDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
}

class Dashboard extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.updateSystemStatus();
    }

    onParametersChanged(params) {
        if (params['satellite-id']) {
            this.updateDisplay('active-satellite', `Active: ${params['satellite-id']}`);
        }
    }

    updateSystemStatus() {
        const params = this.paramManager.getAllParameters();
        const hasRequiredParams = params['satellite-id'] && params['frequency'];
        
        const statusElement = document.querySelector('.status-indicator');
        if (statusElement) {
            statusElement.className = hasRequiredParams ? 'status-indicator online' : 'status-indicator offline';
            statusElement.textContent = hasRequiredParams ? 'Online' : 'Offline';
        }
    }
}

class SatelliteConfig extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.loadConfiguration();
    }

    onParametersChanged(params) {
        if (params['satellite-id']) {
            this.loadSatelliteSpecificConfig(params['satellite-id']);
        }
    }

    loadConfiguration() {
        const params = this.paramManager.getAllParameters();
        if (params['satellite-id']) {
            this.loadSatelliteSpecificConfig(params['satellite-id']);
        }
    }

    loadSatelliteSpecificConfig(satelliteId) {
        const orbitalParams = document.getElementById('orbital-params');
        if (orbitalParams) {
            orbitalParams.value = `Configuration for ${satelliteId}\nAltitude: 550km\nInclination: 53.0°\nPeriod: 95.6 min`;
        }
    }
}

class NetworkAnalysis extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.updateAnalysis();
        this.drawCoverageMap();
    }

    onParametersChanged(params) {
        this.updateSignalQuality(params);
    }

    updateAnalysis() {
        const params = this.paramManager.getAllParameters();
        this.updateSignalQuality(params);
    }

    updateSignalQuality(params) {
        if (params.frequency) {
            const frequency = parseFloat(params.frequency);
            const snr = Math.max(10, 30 - (frequency - 2000) / 100);
            const rsrp = Math.max(-120, -80 - (frequency - 2000) / 200);
            
            this.updateDisplay('snr-value', `${snr.toFixed(1)} dB`);
            this.updateDisplay('rsrp-value', `${rsrp.toFixed(1)} dBm`);
        }
    }

    drawCoverageMap() {
        const canvas = document.getElementById('coverage-map');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#e3f2fd';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#2196f3';
            ctx.beginPath();
            ctx.arc(200, 150, 80, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Coverage Area', 200, 155);
        }
    }
}

class Monitoring extends BasePage {
    constructor(paramManager) {
        super(paramManager);
        this.chartData = [];
        this.maxDataPoints = 50;
    }

    onPageEnter() {
        super.onPageEnter();
        this.startMonitoring();
        this.drawLatencyChart();
    }

    onPageExit() {
        super.onPageExit();
        this.stopMonitoring();
    }

    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
        }, 2000);
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }

    updateMetrics() {
        const params = this.paramManager.getAllParameters();
        const latency = 20 + Math.random() * 10;
        
        this.chartData.push({
            timestamp: new Date(),
            latency: latency
        });
        
        if (this.chartData.length > this.maxDataPoints) {
            this.chartData.shift();
        }
        
        this.drawLatencyChart();
    }

    drawLatencyChart() {
        const canvas = document.getElementById('latency-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const stepX = canvas.width / (this.maxDataPoints - 1);
        
        this.chartData.forEach((point, index) => {
            const x = index * stepX;
            const y = canvas.height - (point.latency / 50 * canvas.height);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('Latency (ms)', 10, 20);
        
        if (this.chartData.length > 0) {
            const latest = this.chartData[this.chartData.length - 1];
            ctx.fillText(`Current: ${latest.latency.toFixed(1)}ms`, 10, canvas.height - 10);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const paramManager = new ParameterManager();
    const pageManager = new PageManager(paramManager);
    
    window.paramManager = paramManager;
    window.pageManager = pageManager;
});