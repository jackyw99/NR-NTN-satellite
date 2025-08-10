class ParameterManager {
    constructor() {
        this.parameters = {};
        this.subscribers = new Map();
        this.initializeParameters();
        this.setupEventListeners();
        this.setupRangeSliders();
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

    setupRangeSliders() {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(range => {
            const updateValue = () => {
                const valueSpan = range.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    valueSpan.textContent = range.value + '°';
                }
            };
            
            updateValue();
            range.addEventListener('input', updateValue);
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
        this.currentPage = 'overview';
        this.pages = {};
        this.initializeNavigation();
        this.initializePages();
    }

    initializeNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pageName = e.target.dataset.page;
                const url = e.target.dataset.url;
                
                if (url) {
                    this.openDetailPage(url);
                } else {
                    this.switchPage(pageName);
                }
            });
        });
    }

    initializePages() {
        this.pages.overview = new SystemOverview(this.paramManager);
        this.pages['satellite-config'] = new SatelliteConfig(this.paramManager);
        this.pages.trajectory = new TrajectoryAnalysis(this.paramManager);
        this.pages.coverage = new CoverageAnalysis(this.paramManager);
        this.pages.performance = new PerformanceMetrics(this.paramManager);
    }

    openDetailPage(url) {
        const params = this.paramManager.getAllParameters();
        const paramString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${paramString}`;
        window.open(fullUrl, '_blank');
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

class SystemOverview extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.updateSatelliteInfo();
        this.updateGroundAssets();
    }

    onParametersChanged(params) {
        this.updateSatelliteInfo();
        this.calculateElevations(params);
    }

    updateSatelliteInfo() {
        const params = this.paramManager.getAllParameters();
        const numSats = parseInt(params['num-satellites']) || 4;
        const altitudeModel = params['altitude-model'] || 'LE600';
        
        for (let i = 1; i <= 4; i++) {
            const satInfo = document.querySelector(`[data-sat="${i}"]`);
            const statusElement = satInfo?.querySelector('.sat-status');
            
            if (i <= numSats) {
                satInfo?.style.setProperty('display', 'block');
                if (statusElement) {
                    statusElement.className = 'sat-status active';
                    statusElement.textContent = 'Active';
                }
            } else {
                satInfo?.style.setProperty('display', 'none');
            }
        }
    }

    calculateElevations(params) {
        const startElevation = parseFloat(params['start-elevation']) || 30;
        const elevationSpread = [0, 22, -8, -15]; // Offsets for each satellite
        
        for (let i = 1; i <= 4; i++) {
            const elevation = startElevation + elevationSpread[i-1];
            const elevationElement = document.getElementById(`sat${i}-elevation`);
            if (elevationElement) {
                elevationElement.textContent = `${Math.max(15, elevation)}°`;
            }
        }
    }

    updateGroundAssets() {
        // Ground assets are fixed in Northern Taiwan as per requirements
        const gsElement = document.querySelector('.ground-assets .asset-info:first-child .status');
        const hdElement = document.querySelector('.ground-assets .asset-info:last-child .status');
        
        if (gsElement) gsElement.textContent = 'Online';
        if (hdElement) hdElement.textContent = 'Connected';
    }
}

class SatelliteConfig extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.updateSatelliteCards();
    }

    onParametersChanged(params) {
        this.updateSatelliteCards();
        this.updateAltitudeInfo(params);
    }

    updateSatelliteCards() {
        const params = this.paramManager.getAllParameters();
        const altitudeModel = params['altitude-model'] || 'LE600';
        const altitudes = {
            'LE350': 350,
            'LE600': 600,
            'LEO1200': 1200,
            'GEO': 35786
        };
        
        const altitude = altitudes[altitudeModel];
        const velocity = altitude < 2000 ? 7.56 : 3.07; // km/s
        
        for (let i = 1; i <= 4; i++) {
            const altElement = document.getElementById(`sat${i}-altitude`);
            const velElement = document.getElementById(`sat${i}-velocity`);
            
            if (altElement) altElement.textContent = `${altitude} km`;
            if (velElement) velElement.textContent = `${velocity} km/s`;
        }
    }

    updateAltitudeInfo(params) {
        const altitudeModel = params['altitude-model'] || 'LE600';
        const positions = [
            { lat: 45.2, lon: 121.8 },
            { lat: 47.1, lon: 119.2 },
            { lat: 42.8, lon: 124.1 },
            { lat: 39.5, lon: 126.8 }
        ];
        
        for (let i = 1; i <= 4; i++) {
            const posElement = document.getElementById(`sat${i}-position`);
            if (posElement) {
                posElement.textContent = `${positions[i-1].lat}°N, ${positions[i-1].lon}°E`;
            }
        }
    }
}

class TrajectoryAnalysis extends BasePage {
    constructor(paramManager) {
        super(paramManager);
        this.simulationRunning = false;
        this.simulationTime = 0;
    }

    onPageEnter() {
        super.onPageEnter();
        this.drawTrajectoryChart();
        this.setupTrajectoryControls();
    }

    onParametersChanged(params) {
        this.drawTrajectoryChart();
    }

    setupTrajectoryControls() {
        const playBtn = document.getElementById('play-simulation');
        const pauseBtn = document.getElementById('pause-simulation');
        const resetBtn = document.getElementById('reset-simulation');
        const speedSlider = document.getElementById('simulation-speed');
        
        if (playBtn) playBtn.addEventListener('click', () => this.startSimulation());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseSimulation());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetSimulation());
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speedValue = document.querySelector('.speed-value');
                if (speedValue) speedValue.textContent = `${e.target.value}x`;
            });
        }
    }

    drawTrajectoryChart() {
        const canvas = document.getElementById('trajectory-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const params = this.paramManager.getAllParameters();
        const startElevation = parseFloat(params['start-elevation']) || 30;
        const maxElevation = parseFloat(params['max-elevation']) || 90;
        
        // Draw trajectory curves for each satellite
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        
        for (let sat = 0; sat < 4; sat++) {
            ctx.strokeStyle = colors[sat];
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            for (let x = 0; x < canvas.width; x += 5) {
                const time = (x / canvas.width) * 120; // 2 hours
                const elevation = startElevation + Math.sin((time + sat * 30) * Math.PI / 60) * (maxElevation - startElevation) / 2;
                const y = canvas.height - (elevation / 180) * canvas.height;
                
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            
            // Label
            ctx.fillStyle = colors[sat];
            ctx.font = '12px Arial';
            ctx.fillText(`Sat ${sat + 1}`, 10, 20 + sat * 15);
        }
        
        // Draw elevation grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        for (let elev = 0; elev <= 180; elev += 30) {
            const y = canvas.height - (elev / 180) * canvas.height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#666';
            ctx.fillText(`${elev}°`, 5, y - 3);
        }
    }

    startSimulation() {
        this.simulationRunning = true;
        // Implementation for animation would go here
    }

    pauseSimulation() {
        this.simulationRunning = false;
    }

    resetSimulation() {
        this.simulationRunning = false;
        this.simulationTime = 0;
        this.drawTrajectoryChart();
    }
}

class CoverageAnalysis extends BasePage {
    onPageEnter() {
        super.onPageEnter();
        this.drawCoverageMap();
        this.updateCoverageMetrics();
    }

    onParametersChanged(params) {
        this.drawCoverageMap();
        this.updateCoverageMetrics();
    }

    drawCoverageMap() {
        const canvas = document.getElementById('coverage-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const params = this.paramManager.getAllParameters();
        const numSats = parseInt(params['num-satellites']) || 4;
        const altitudeModel = params['altitude-model'] || 'LE600';
        
        // Draw Taiwan outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(canvas.width/2, canvas.height/2, 80, 120, 0, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Draw coverage areas
        const coverageRadius = altitudeModel === 'GEO' ? 200 : 100;
        const positions = [
            { x: canvas.width * 0.3, y: canvas.height * 0.3 },
            { x: canvas.width * 0.7, y: canvas.height * 0.3 },
            { x: canvas.width * 0.3, y: canvas.height * 0.7 },
            { x: canvas.width * 0.7, y: canvas.height * 0.7 }
        ];
        
        for (let i = 0; i < numSats; i++) {
            ctx.fillStyle = `rgba(42, 82, 152, ${0.3 - i * 0.05})`;
            ctx.beginPath();
            ctx.arc(positions[i].x, positions[i].y, coverageRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Mark ground station and handheld device
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(canvas.width/2 - 10, canvas.height/2 + 20, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(canvas.width/2 + 10, canvas.height/2 + 25, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    updateCoverageMetrics() {
        const params = this.paramManager.getAllParameters();
        const numSats = parseInt(params['num-satellites']) || 4;
        const altitudeModel = params['altitude-model'] || 'LE600';
        
        const baseCoverage = altitudeModel === 'GEO' ? 15000 : 2847;
        const totalCoverage = baseCoverage * numSats * 0.7; // Account for overlap
        
        this.updateDisplay('total-coverage', `${Math.round(totalCoverage).toLocaleString()} km²`);
        this.updateDisplay('overlap-regions', `${Math.round(15 * numSats / 4)}%`);
        this.updateDisplay('coverage-efficiency', `${Math.round(87 + numSats * 2)}%`);
    }
}

class PerformanceMetrics extends BasePage {
    constructor(paramManager) {
        super(paramManager);
        this.performanceData = [];
        this.maxDataPoints = 60;
    }

    onPageEnter() {
        super.onPageEnter();
        this.updateMetrics();
        this.drawPerformanceChart();
        this.startMetricsUpdate();
    }

    onPageExit() {
        this.stopMetricsUpdate();
    }

    onParametersChanged(params) {
        this.updateMetrics();
    }

    updateMetrics() {
        const params = this.paramManager.getAllParameters();
        const frequency = parseFloat(params.frequency) || 2100;
        const altitude = params['altitude-model'] || 'LE600';
        
        // Calculate performance based on parameters
        const snr = Math.max(15, 30 - Math.abs(frequency - 2100) / 100);
        const rsrp = Math.max(-110, -85 - Math.abs(frequency - 2100) / 200);
        const throughput = Math.min(100, snr * 2);
        
        this.updateDisplay('current-snr', `${snr.toFixed(1)} dB`);
        this.updateDisplay('current-rsrp', `${rsrp.toFixed(1)} dBm`);
        this.updateDisplay('current-throughput', `${throughput.toFixed(1)} Mbps`);
        
        // Update handover stats
        this.updateDisplay('handover-success', '96.8%');
        this.updateDisplay('handover-duration', '127 ms');
        this.updateDisplay('total-handovers', '1,247');
    }

    startMetricsUpdate() {
        this.metricsInterval = setInterval(() => {
            this.updateRealTimeMetrics();
        }, 2000);
    }

    stopMetricsUpdate() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
    }

    updateRealTimeMetrics() {
        const timestamp = new Date();
        const snr = 23.5 + (Math.random() - 0.5) * 5;
        const throughput = 45.2 + (Math.random() - 0.5) * 10;
        
        this.performanceData.push({ timestamp, snr, throughput });
        
        if (this.performanceData.length > this.maxDataPoints) {
            this.performanceData.shift();
        }
        
        this.drawPerformanceChart();
    }

    drawPerformanceChart() {
        const canvas = document.getElementById('performance-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.performanceData.length < 2) return;
        
        const stepX = canvas.width / (this.maxDataPoints - 1);
        
        // Draw SNR line
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.performanceData.forEach((point, index) => {
            const x = index * stepX;
            const y = canvas.height - (point.snr / 50 * canvas.height);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Draw throughput line
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.performanceData.forEach((point, index) => {
            const x = index * stepX;
            const y = canvas.height - (point.throughput / 100 * canvas.height);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('SNR (dB)', 10, 20);
        ctx.fillStyle = '#ff9800';
        ctx.fillText('Throughput (Mbps)', 10, 35);
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

// Global function to open detail pages with parameters
function openDetailPage(type, id) {
    const params = window.paramManager.getAllParameters();
    params['detail-type'] = type;
    if (id) params['detail-id'] = id;
    
    const paramString = new URLSearchParams(params).toString();
    const url = `pages/detailed-analysis.html?${paramString}`;
    window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
    const paramManager = new ParameterManager();
    const pageManager = new PageManager(paramManager);
    
    window.paramManager = paramManager;
    window.pageManager = pageManager;
});