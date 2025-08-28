class ParameterManager {
    constructor() {
        this.parameters = {};
        this.subscribers = new Map();
        this.initializeParameters();
        this.setupEventListeners();
        this.setupRangeSliders();
        this.setupElevationValidation();
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
    
    setupElevationValidation() {
        // Set up real-time validation for elevation angles
        const initialElevation = document.getElementById('initial-elevation');
        const maxElevation = document.getElementById('max-elevation');
        
        if (initialElevation) {
            this.updateCoverageStatus(parseFloat(initialElevation.value));
        }
    }
    
    updateCoverageStatus(elevation) {
        const gsStatus = document.getElementById('gs-status');
        const hhStatus = document.getElementById('hh-status');
        
        // Ground Station: 10-170° range
        const gsInRange = elevation >= 10 && elevation <= 170;
        // Handheld Device: 25-155° range  
        const hhInRange = elevation >= 25 && elevation <= 155;
        
        if (gsStatus) {
            const statusText = gsStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = gsInRange ? 'In Range' : 'Out of Range';
                gsStatus.className = `status-indicator ground-station-status ${gsInRange ? 'in-range' : 'out-of-range'}`;
            }
        }
        
        if (hhStatus) {
            const statusText = hhStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = hhInRange ? 'In Range' : 'Out of Range';
                hhStatus.className = `status-indicator handheld-status ${hhInRange ? 'in-range' : 'out-of-range'}`;
            }
        }
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
        console.log(`Found ${navButtons.length} navigation buttons`);
        
        navButtons.forEach((btn, index) => {
            console.log(`Button ${index}: page="${btn.dataset.page}", url="${btn.dataset.url}"`);
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = e.target.dataset.page;
                const url = e.target.dataset.url;
                
                console.log(`Navigation clicked: page="${pageName}", url="${url}"`);
                
                if (url) {
                    this.openDetailPage(url);
                } else if (pageName) {
                    this.switchPage(pageName);
                } else {
                    console.error('No page name or URL found in navigation button');
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
        console.log(`Switching to page: ${pageName}`);
        
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked nav button
        const targetBtn = document.querySelector(`[data-page="${pageName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        } else {
            console.warn(`Navigation button for page "${pageName}" not found`);
        }

        // Hide all page content
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show target page content
        const targetPage = document.getElementById(pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            console.log(`Successfully switched to page: ${pageName}`);
        } else {
            console.error(`Page content element with ID "${pageName}" not found`);
            return;
        }

        // Handle page lifecycle
        if (this.pages[this.currentPage]) {
            this.pages[this.currentPage].onPageExit();
        }

        this.currentPage = pageName;
        
        if (this.pages[pageName]) {
            this.pages[pageName].onPageEnter();
        } else {
            console.warn(`Page class for "${pageName}" not initialized`);
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
        // Use elevations from satellite config page if available
        const satConfigPage = this.paramManager?.pageManager?.pages?.['satellite-config'];
        
        if (satConfigPage && satConfigPage.satelliteElevations) {
            // Use elevations from individual satellite controls
            Object.keys(satConfigPage.satelliteElevations).forEach(satId => {
                const elevation = satConfigPage.satelliteElevations[satId];
                const elevationElement = document.getElementById(`sat${satId}-elevation`);
                
                if (elevationElement) {
                    elevationElement.textContent = `${elevation}°`;
                    
                    // Update satellite status based on elevation ranges
                    const satInfo = document.querySelector(`[data-sat="${satId}"]`);
                    const statusElement = satInfo?.querySelector('.sat-status');
                    
                    if (statusElement && elevation >= 10 && elevation <= 170) {
                        if (elevation >= 25 && elevation <= 155) {
                            statusElement.className = 'sat-status active';
                            statusElement.textContent = 'Active';
                        } else {
                            statusElement.className = 'sat-status standby';
                            statusElement.textContent = 'GS Only';
                        }
                    } else {
                        statusElement.className = 'sat-status inactive';
                        statusElement.textContent = 'Out of Range';
                    }
                }
            });
        } else {
            // Fallback to slider-based calculation
            const initialElevation = parseFloat(params['initial-elevation']) || 45;
            const elevationSpread = [0, 22, -8, -15]; // Offsets for each satellite
            
            for (let i = 1; i <= 4; i++) {
                const elevation = Math.max(10, Math.min(170, initialElevation + elevationSpread[i-1]));
                const elevationElement = document.getElementById(`sat${i}-elevation`);
                
                if (elevationElement) {
                    elevationElement.textContent = `${elevation}°`;
                    
                    // Update satellite status based on elevation ranges
                    const satInfo = document.querySelector(`[data-sat="${i}"]`);
                    const statusElement = satInfo?.querySelector('.sat-status');
                    
                    if (statusElement && elevation >= 10 && elevation <= 170) {
                        if (elevation >= 25 && elevation <= 155) {
                            statusElement.className = 'sat-status active';
                            statusElement.textContent = 'Active';
                        } else {
                            statusElement.className = 'sat-status standby';
                            statusElement.textContent = 'GS Only';
                        }
                    } else {
                        statusElement.className = 'sat-status inactive';
                        statusElement.textContent = 'Out of Range';
                    }
                }
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
    constructor(paramManager) {
        super(paramManager);
        this.satelliteElevations = {
            1: 45,
            2: 67,
            3: 22,
            4: 15
        };
        this.satellitePositions = {
            1: { lat: 26.0330, lon: 121.5654 }, // North
            2: { lat: 25.0330, lon: 122.5654 }, // East  
            3: { lat: 24.0330, lon: 121.5654 }, // South
            4: { lat: 25.0330, lon: 120.5654 }  // West
        };
        this.groundStation = { lat: 25.0330, lon: 121.5654 };
        this.handheldDevice = { lat: 25.0320, lon: 121.5644 };
        this.selectedSatellite = 1;
    }

    onPageEnter() {
        super.onPageEnter();
        this.setupInteractiveMap();
        this.setupElevationControls();
        this.updateAllSatelliteStatus();
        this.updateAllSatellitePositions();
        this.updateOverview();
        this.drawPositioningMap();
    }

    onParametersChanged(params) {
        this.updateSatelliteAltitudes();
        this.updateAllSatelliteStatus();
        this.updateOverview();
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

    setupInteractiveMap() {
        const canvas = document.getElementById('positioning-canvas');
        const satelliteSelector = document.getElementById('satellite-selector');
        
        if (canvas && !canvas.hasClickListener) {
            canvas.addEventListener('click', (e) => this.handleMapClick(e));
            canvas.hasClickListener = true;
        }
        
        if (satelliteSelector) {
            satelliteSelector.addEventListener('change', (e) => {
                this.selectedSatellite = parseInt(e.target.value);
                this.updateSelectedSatelliteInfo();
                this.drawPositioningMap();
            });
        }
        
        this.updateSelectedSatelliteInfo();
    }
    
    setupElevationControls() {
        // Setup individual elevation sliders for each satellite
        for (let satId = 1; satId <= 4; satId++) {
            const slider = document.getElementById(`sat${satId}-elevation-slider`);
            const valueDisplay = document.getElementById(`sat${satId}-elevation-value`);
            
            if (slider && valueDisplay) {
                // Set initial value
                slider.value = this.satelliteElevations[satId];
                valueDisplay.textContent = `${this.satelliteElevations[satId]}°`;
                
                // Add event listener
                slider.addEventListener('input', (e) => {
                    const elevation = parseFloat(e.target.value);
                    this.satelliteElevations[satId] = elevation;
                    valueDisplay.textContent = `${elevation}°`;
                    
                    this.updateSatelliteStatus(satId, elevation);
                    this.updateOverview();
                    this.drawPositioningMap();
                });
            }
        }
    }
    
    handleMapClick(event) {
        const canvas = document.getElementById('positioning-canvas');
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert canvas coordinates to lat/lon
        // Canvas center represents ground station
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 250; // pixels per degree (increased for larger canvas)
        
        const latOffset = -(y - centerY) / scale; // Negative because canvas Y is inverted
        const lonOffset = (x - centerX) / scale;
        
        const lat = this.groundStation.lat + latOffset;
        const lon = this.groundStation.lon + lonOffset;
        
        // Update selected satellite position
        this.satellitePositions[this.selectedSatellite] = { lat: lat, lon: lon };
        
        // Update displays
        this.updateSelectedSatelliteInfo();
        this.drawPositioningMap();
        this.updateSatelliteStatus(this.selectedSatellite, this.satelliteElevations[this.selectedSatellite]);
        this.updateAllSatellitePositions();
    }
    
    updateSatelliteStatus(satId, elevation) {
        // Update coverage indicators
        const gsIndicator = document.getElementById(`sat${satId}-gs-indicator`);
        const hhIndicator = document.getElementById(`sat${satId}-hh-indicator`);
        const statusText = document.getElementById(`sat${satId}-status-text`);
        const position = document.getElementById(`sat${satId}-position`);
        
        // Ground Station: 10-170° range
        const gsInRange = elevation >= 10 && elevation <= 170;
        // Handheld Device: 25-155° range  
        const hhInRange = elevation >= 25 && elevation <= 155;
        
        if (gsIndicator) {
            gsIndicator.textContent = `Ground Station: ${gsInRange ? 'In Range' : 'Out of Range'}`;
            gsIndicator.className = gsInRange ? 'coverage-indicator gs-indicator' : 'coverage-indicator gs-indicator out-of-range';
        }
        
        if (hhIndicator) {
            hhIndicator.textContent = `Handheld: ${hhInRange ? 'In Range' : 'Out of Range'}`;
            hhIndicator.className = hhInRange ? 'coverage-indicator hh-indicator' : 'coverage-indicator hh-indicator out-of-range';
        }
        
        // Update status and position
        if (statusText) {
            if (gsInRange) {
                if (hhInRange) {
                    statusText.textContent = 'Active';
                    statusText.className = 'value status-active';
                } else {
                    statusText.textContent = 'GS Only';
                    statusText.className = 'value status-standby';
                }
            } else {
                statusText.textContent = 'Out of Range';
                statusText.className = 'value status-inactive';
            }
        }
        
        if (position) {
            const pos = this.satellitePositions[satId];
            if (pos) {
                position.textContent = `${pos.lat.toFixed(2)}°N, ${pos.lon.toFixed(2)}°E`;
            }
        }
    }
    
    updateAllSatelliteStatus() {
        for (let satId = 1; satId <= 4; satId++) {
            this.updateSatelliteStatus(satId, this.satelliteElevations[satId]);
        }
    }
    
    updateOverview() {
        let gsCount = 0;
        let hhCount = 0;
        let optimalCount = 0;
        
        for (let satId = 1; satId <= 4; satId++) {
            const elevation = this.satelliteElevations[satId];
            
            if (elevation >= 10 && elevation <= 170) gsCount++;
            if (elevation >= 25 && elevation <= 155) {
                hhCount++;
                optimalCount++;
            }
        }
        
        // Update summary displays
        const gsCoverage = document.getElementById('total-gs-coverage');
        const hhCoverage = document.getElementById('total-hh-coverage');
        const optimalRange = document.getElementById('optimal-range-count');
        
        if (gsCoverage) gsCoverage.textContent = `${gsCount}/4 satellites`;
        if (hhCoverage) hhCoverage.textContent = `${hhCount}/4 satellites`;
        if (optimalRange) optimalRange.textContent = `${optimalCount}/4 satellites`;
    }
    
    updateSatelliteAltitudes() {
        const params = this.paramManager.getAllParameters();
        const altitudeModel = params['altitude-model'] || 'LE600';
        const altitudes = {
            'LE350': 350,
            'LE600': 600,
            'LEO1200': 1200,
            'GEO': 35786
        };
        
        // Update altitude display in overview would be implemented here if needed
        // For now, altitude affects the position calculation in updateSatelliteStatus
    }
    
    getAltitudeFromModel() {
        const params = this.paramManager.getAllParameters();
        const altitudeModel = params['altitude-model'] || 'LE600';
        const altitudes = {
            'LE350': 350,
            'LE600': 600,
            'LEO1200': 1200,
            'GEO': 35786
        };
        return altitudes[altitudeModel];
    }
    
    drawPositioningMap() {
        const canvas = document.getElementById('positioning-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 250; // pixels per degree (increased for larger canvas)
        
        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // Vertical lines (longitude)
        for (let i = -2; i <= 2; i++) {
            const x = centerX + i * scale;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines (latitude)
        for (let i = -2; i <= 2; i++) {
            const y = centerY + i * scale;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw center crosshairs
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 20, centerY);
        ctx.lineTo(centerX + 20, centerY);
        ctx.moveTo(centerX, centerY - 20);
        ctx.lineTo(centerX, centerY + 20);
        ctx.stroke();
        
        // Draw ground station
        ctx.fillStyle = '#1976d2';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GS', centerX, centerY + 4);
        
        // Draw handheld device (very close to GS)
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY + 3, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('HH', centerX + 3, centerY + 7);
        
        // Draw satellites
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        const labels = ['S1', 'S2', 'S3', 'S4'];
        
        Object.keys(this.satellitePositions).forEach(satId => {
            const pos = this.satellitePositions[satId];
            const satX = centerX + (pos.lon - this.groundStation.lon) * scale;
            const satY = centerY - (pos.lat - this.groundStation.lat) * scale; // Negative because canvas Y is inverted
            
            ctx.fillStyle = colors[satId - 1];
            
            if (parseInt(satId) === this.selectedSatellite) {
                // Highlight selected satellite
                ctx.beginPath();
                ctx.arc(satX, satY, 12, 0, 2 * Math.PI);
                ctx.fill();
                
                // Add selection ring
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(satX, satY, 16, 0, 2 * Math.PI);
                ctx.stroke();
                
                // Draw line from GS to selected satellite
                ctx.strokeStyle = colors[satId - 1];
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(satX, satY);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.beginPath();
                ctx.arc(satX, satY, 8, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            // Label satellite
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(labels[satId - 1], satX, satY + 3);
        });
        
        // Reset text alignment
        ctx.textAlign = 'left';
    }
    
    updateSelectedSatelliteInfo() {
        const satInfo = document.getElementById('selected-sat-info');
        const satPosition = document.getElementById('selected-sat-position');
        const satDirection = document.getElementById('selected-sat-direction');
        const satDistance = document.getElementById('selected-sat-distance');
        
        if (satInfo) {
            satInfo.textContent = `Satellite ${this.selectedSatellite}`;
        }
        
        const pos = this.satellitePositions[this.selectedSatellite];
        if (pos && satPosition) {
            satPosition.textContent = `${pos.lat.toFixed(3)}°N, ${pos.lon.toFixed(3)}°E`;
            
            // Calculate direction and distance from ground station
            const latDiff = pos.lat - this.groundStation.lat;
            const lonDiff = pos.lon - this.groundStation.lon;
            
            // Calculate bearing
            const bearing = Math.atan2(lonDiff, latDiff) * 180 / Math.PI;
            let direction = '';
            
            if (bearing >= -22.5 && bearing < 22.5) direction = 'North';
            else if (bearing >= 22.5 && bearing < 67.5) direction = 'Northeast';
            else if (bearing >= 67.5 && bearing < 112.5) direction = 'East';
            else if (bearing >= 112.5 && bearing < 157.5) direction = 'Southeast';
            else if (bearing >= 157.5 || bearing < -157.5) direction = 'South';
            else if (bearing >= -157.5 && bearing < -112.5) direction = 'Southwest';
            else if (bearing >= -112.5 && bearing < -67.5) direction = 'West';
            else if (bearing >= -67.5 && bearing < -22.5) direction = 'Northwest';
            
            if (satDirection) satDirection.textContent = direction;
            
            // Calculate distance in km
            const distance = this.calculateDistance(pos, this.groundStation);
            if (satDistance) satDistance.textContent = `${distance.toFixed(1)} km`;
        }
    }
    
    calculateDistance(pos1, pos2) {
        const R = 6371; // Earth's radius in km
        const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
        const dLon = (pos2.lon - pos1.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    updateAllSatellitePositions() {
        // Update position display in all satellite cards
        for (let satId = 1; satId <= 4; satId++) {
            const positionElement = document.getElementById(`sat${satId}-position`);
            const pos = this.satellitePositions[satId];
            
            if (positionElement && pos) {
                positionElement.textContent = `${pos.lat.toFixed(2)}°N, ${pos.lon.toFixed(2)}°E`;
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
        const satConfigPage = this.paramManager?.pageManager?.pages?.['satellite-config'];
        let initialElevation = parseFloat(params['initial-elevation']) || 45;
        const maxElevation = parseFloat(params['max-elevation']) || 90;
        
        // Use satellite positions from interactive map if available
        if (satConfigPage && satConfigPage.satellitePositions) {
            // Calculate average elevation from all satellites for trajectory baseline
            const elevations = Object.keys(satConfigPage.satellitePositions).map(satId => {
                const satPos = satConfigPage.satellitePositions[satId];
                const distance = satConfigPage.calculateDistance(satPos, satConfigPage.groundStation);
                const altitude = satConfigPage.getAltitudeFromModel();
                return Math.atan2(altitude, distance) * (180 / Math.PI);
            });
            initialElevation = elevations.reduce((sum, el) => sum + el, 0) / elevations.length;
        }
        
        // Draw trajectory curves for each satellite
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        
        for (let sat = 0; sat < 4; sat++) {
            ctx.strokeStyle = colors[sat];
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            for (let x = 0; x < canvas.width; x += 5) {
                const time = (x / canvas.width) * 120; // 2 hours
                const elevation = Math.max(10, Math.min(170, initialElevation + Math.sin((time + sat * 30) * Math.PI / 60) * (maxElevation - initialElevation) / 2));
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
    try {
        console.log('Initializing NR-NTN application...');
        
        const paramManager = new ParameterManager();
        console.log('ParameterManager initialized');
        
        const pageManager = new PageManager(paramManager);
        console.log('PageManager initialized');
        
        // Make pageManager accessible to ParameterManager for cross-references
        paramManager.pageManager = pageManager;
        
        window.paramManager = paramManager;
        window.pageManager = pageManager;
        
        console.log('Application initialization complete');
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});