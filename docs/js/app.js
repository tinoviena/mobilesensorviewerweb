"use strict";
class SensorViewer {
    constructor() {
        this.db = null;
        this.dbName = 'sensor-viewer-db';
        this.storeName = 'measurements';
        this.currentMeasurement = {
            timestamp: '',
            sensorAPI: 'unknown',
            gpsLat: null,
            gpsLon: null,
            gpsAcc: null,
            accelX: null,
            accelY: null,
            accelZ: null,
            linearAccelX: null,
            linearAccelY: null,
            linearAccelZ: null,
            gyroX: null,
            gyroY: null,
            gyroZ: null,
        };
        this.isListening = false;
        this.pendingLinearAccel = null;
        this.pendingAccel = null;
        this.pendingGyro = null;
        this.pendingGPS = null;
        this.geoWatchId = null;
        this.pearlPos = { x: 0, y: 0 };
        this.pearlVel = { x: 0, y: 0 };
        this.pearlRadius = 20;
        this.lastAccelReading = null;
        this.gravityEstimate = { x: 0, y: 0, z: 0 };
        this.gravityAlpha = 0.8;
        this.refreshTimer = null;
        this.refreshIntervalMs = 16; // 60fps for smoother updates
        this.headingListening = false;
        this.currentHeading = 0;
        this.isRecording = false;
        this.statusEl = this.getElementById('status');
        this.enableButton = this.getElementById('enableButton');
        this.sensorContainer = this.getElementById('sensorContainer');
        this.linearAccelDisplay = {
            X: this.getElementById('linearAccelX'),
            Y: this.getElementById('linearAccelY'),
            Z: this.getElementById('linearAccelZ'),
        };
        this.accelDisplay = {
            X: this.getElementById('accelX'),
            Y: this.getElementById('accelY'),
            Z: this.getElementById('accelZ'),
        };
        this.gyroDisplay = {
            X: this.getElementById('gyroX'),
            Y: this.getElementById('gyroY'),
            Z: this.getElementById('gyroZ'),
        };
        this.gpsDisplay = {
            latitude: this.getElementById('gpsLat'),
            longitude: this.getElementById('gpsLon'),
            accuracy: this.getElementById('gpsAcc'),
        };
        this.headingDisplay = this.getElementById('headingDisplay');
        this.buildNumberEl = this.getElementById('buildNumber');
        this.loadBuildNumber();
        this.sensorAPIEl = this.getElementById('sensorAPI');
        this.accelAvailableEl = this.getElementById('accelAvailable');
        this.gyroAvailableEl = this.getElementById('gyroAvailable');
        this.linearAccelAvailableEl = this.getElementById('linearAccelAvailable');
        this.downloadClearButton = this.getElementById('downloadClearButton');
        this.recordingToggleButton = this.getElementById('recordingToggleButton');
        this.visualizationButton = this.getElementById('visualizationButton');
        this.backButton = this.getElementById('backButton');
        this.visualizationContainer = this.getElementById('visualizationContainer');
        this.vizCanvas = this.getElementById('vizCanvas');
        this.vizCtx = this.vizCanvas.getContext('2d');
        this.setupEventListeners();
        this.initDatabase();
        this.checkDeviceMotionPermission();
    }
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id "${id}" not found`);
        }
        return element;
    }
    setupEventListeners() {
        this.enableButton.addEventListener('click', () => this.requestSensorPermission());
        this.downloadClearButton.addEventListener('click', () => this.downloadAndEmptyDB());
        this.recordingToggleButton.addEventListener('click', () => {
            this.isRecording = !this.isRecording;
            this.recordingToggleButton.textContent = this.isRecording ? '⏹ Stop Recording' : '⏺ Start Recording';
            this.recordingToggleButton.style.background = this.isRecording
                ? 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)'
                : '';
        });
        this.visualizationButton.addEventListener('click', () => this.showVisualization());
        this.backButton.addEventListener('click', () => this.showMainView());
        window.addEventListener('resize', () => {
            if (!this.visualizationContainer.classList.contains('hidden')) {
                this.resizeCanvas();
            }
        });
    }
    checkDeviceMotionPermission() {
        // Check sensor availability
        const hasDeviceMotion = typeof DeviceMotionEvent !== 'undefined';
        const hasDeviceMotionPermission = hasDeviceMotion && typeof DeviceMotionEvent.requestPermission === 'function';
        const hasAccelerometer = typeof Accelerometer !== 'undefined';
        const hasGyroscope = typeof Gyroscope !== 'undefined';
        const hasLinearAcceleration = typeof globalThis.LinearAccelerationSensor !== 'undefined';
        console.log('Sensor availability:', {
            hasDeviceMotion,
            hasDeviceMotionPermission,
            hasAccelerometer,
            hasGyroscope,
            hasLinearAcceleration,
            'typeof DeviceMotionEvent': typeof DeviceMotionEvent,
            'typeof Accelerometer': typeof Accelerometer,
            'typeof Gyroscope': typeof Gyroscope,
            'typeof LinearAccelerationSensor': typeof globalThis.LinearAccelerationSensor
        });
        // Update diagnostic display
        this.sensorAPIEl.textContent = 'Checking...';
        this.accelAvailableEl.textContent = hasAccelerometer ? '✅ Available' : '❌ Not available';
        this.gyroAvailableEl.textContent = hasGyroscope ? '✅ Available' : '❌ Not available';
        this.linearAccelAvailableEl.textContent = hasLinearAcceleration ? '✅ Available' : '❌ Not available';
        // Check if we have access to modern Sensor API or older DeviceMotionEvent
        if (hasDeviceMotionPermission || hasAccelerometer) {
            // Modern Sensor API available (iOS 13+, some Android devices)
            this.updateStatus('Sensors available. Tap button to enable.', 'waiting');
        }
        else if (hasDeviceMotion) {
            // Fallback to older DeviceMotionEvent API
            this.updateStatus('Sensors available. Tap button to enable.', 'waiting');
        }
        else {
            this.updateStatus('Sensors not supported on this device/browser', 'error');
            this.enableButton.classList.add('hidden');
        }
    }
    async requestSensorPermission() {
        try {
            // Try modern Sensor API first (iOS 13+)
            if (typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function') {
                const permissionAccel = await DeviceMotionEvent.requestPermission();
                const permissionGyro = await DeviceMotionEvent.requestPermission();
                if (permissionAccel === 'granted' && permissionGyro === 'granted') {
                    this.startListeningModern();
                }
                else {
                    this.updateStatus('Permission denied', 'error');
                }
            }
            else if (typeof Accelerometer !== 'undefined') {
                // Generic Sensor API
                this.startListeningGenericSensor();
            }
            else {
                // Fallback to older DeviceMotionEvent (no permission request needed)
                this.startListeningDeviceMotion();
            }
        }
        catch (error) {
            console.error('Permission request failed:', error);
            this.updateStatus('Permission request failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    }
    startListeningModern() {
        this.isListening = true;
        this.sensorContainer.classList.remove('hidden');
        this.visualizationButton.classList.remove('hidden');
        this.updateStatus('Sensors enabled', 'ready');
        this.enableButton.classList.add('hidden');
        this.sensorAPIEl.textContent = 'DeviceMotionEvent (iOS)';
        this.currentMeasurement.sensorAPI = 'DeviceMotionEvent (iOS)';
        window.addEventListener('devicemotion', (event) => {
            if (event.accelerationIncludingGravity) {
                this.pendingAccel = event.accelerationIncludingGravity;
            }
            if (event.acceleration) {
                this.pendingLinearAccel = event.acceleration;
            }
            if (event.rotationRate) {
                this.pendingGyro = event.rotationRate;
            }
            this.ensureRefreshTimer();
        });
        this.startGPS();
        this.startHeadingListener();
    }
    startListeningDeviceMotion() {
        this.isListening = true;
        this.sensorContainer.classList.remove('hidden');
        this.visualizationButton.classList.remove('hidden');
        this.updateStatus('Sensors enabled (legacy mode)', 'ready');
        this.enableButton.classList.add('hidden');
        this.sensorAPIEl.textContent = 'DeviceMotionEvent (Legacy)';
        this.currentMeasurement.sensorAPI = 'DeviceMotionEvent (Legacy)';
        window.addEventListener('devicemotion', (event) => {
            if (event.accelerationIncludingGravity) {
                this.pendingAccel = event.accelerationIncludingGravity;
            }
            if (event.acceleration) {
                this.pendingLinearAccel = event.acceleration;
            }
            if (event.rotationRate) {
                this.pendingGyro = event.rotationRate;
            }
            this.ensureRefreshTimer();
        });
        this.startGPS();
        this.startHeadingListener();
    }
    initDatabase() {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => {
            this.db = request.result;
            console.log('IndexedDB initialized:', this.dbName);
        };
        request.onerror = () => {
            console.error('IndexedDB init failed:', request.error);
        };
    }
    async getAllRecords() {
        if (!this.db) {
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const records = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    records.push(cursor.value);
                    cursor.continue();
                }
                else {
                    resolve(records);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    clearDatabase() {
        if (!this.db) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    convertRecordsToCSV(records) {
        const headers = [
            'id',
            'timestamp',
            'sensorAPI',
            'gpsLat',
            'gpsLon',
            'gpsAcc',
            'accelX',
            'accelY',
            'accelZ',
            'linearAccelX',
            'linearAccelY',
            'linearAccelZ',
            'gyroX',
            'gyroY',
            'gyroZ',
        ];
        const escapeValue = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            const text = String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const rows = records.map((record) => headers.map((header) => escapeValue(record[header])).join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }
    async downloadAndEmptyDB() {
        if (!this.db) {
            this.updateStatus('Database not initialized yet.', 'error');
            return;
        }
        try {
            const records = await this.getAllRecords();
            const filename = `sensor-records-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            const csv = this.convertRecordsToCSV(records);
            this.downloadCSV(csv, filename);
            await this.clearDatabase();
            this.updateStatus('Database downloaded and cleared', 'ready');
        }
        catch (error) {
            console.error('Failed to download and clear DB:', error);
            this.updateStatus('Failed to download/clear DB', 'error');
        }
    }
    saveRecord(record) {
        if (!this.db) {
            console.warn('IndexedDB not ready, record not saved');
            return;
        }
        const transaction = this.db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(record);
        request.onerror = () => {
            console.error('Failed to save record:', request.error);
        };
    }
    createMeasurementRecord() {
        return {
            timestamp: new Date().toISOString(),
            sensorAPI: this.currentMeasurement.sensorAPI,
            gpsLat: this.currentMeasurement.gpsLat,
            gpsLon: this.currentMeasurement.gpsLon,
            gpsAcc: this.currentMeasurement.gpsAcc,
            accelX: this.currentMeasurement.accelX,
            accelY: this.currentMeasurement.accelY,
            accelZ: this.currentMeasurement.accelZ,
            linearAccelX: this.currentMeasurement.linearAccelX,
            linearAccelY: this.currentMeasurement.linearAccelY,
            linearAccelZ: this.currentMeasurement.linearAccelZ,
            gyroX: this.currentMeasurement.gyroX,
            gyroY: this.currentMeasurement.gyroY,
            gyroZ: this.currentMeasurement.gyroZ,
        };
    }
    startListeningGenericSensor() {
        try {
            const hasGyroscope = typeof Gyroscope !== 'undefined';
            const hasLinearAcceleration = typeof globalThis.LinearAccelerationSensor !== 'undefined';
            console.log('Starting Generic Sensor API with available sensors:', {
                Accelerometer: true,
                Gyroscope: hasGyroscope,
                LinearAcceleration: hasLinearAcceleration
            });
            const accel = new Accelerometer({ frequency: 60 });
            accel.addEventListener('reading', () => {
                const accelReading = { x: accel.x, y: accel.y, z: accel.z };
                console.log('Accelerometer reading:', accelReading.x, accelReading.y, accelReading.z);
                this.pendingAccel = accelReading;
                this.lastAccelReading = accelReading;
                this.updateGravityEstimate(accelReading);
                if (!hasLinearAcceleration) {
                    this.pendingLinearAccel = this.deriveLinearAcceleration(accelReading);
                }
                this.ensureRefreshTimer();
            });
            if (hasLinearAcceleration) {
                const LinearAccelerationCtor = globalThis.LinearAccelerationSensor;
                const linearAccel = new LinearAccelerationCtor({ frequency: 60 });
                linearAccel.addEventListener('reading', () => {
                    const sensorReading = {
                        x: linearAccel.x,
                        y: linearAccel.y,
                        z: linearAccel.z,
                    };
                    console.log('LinearAcceleration reading:', sensorReading.x, sensorReading.y, sensorReading.z);
                    if (this.lastAccelReading) {
                        const derived = this.deriveLinearAcceleration(this.lastAccelReading);
                        if (this.isSuspiciousLinearReading(sensorReading, derived)) {
                            console.warn('LinearAccelerationSensor appears unreliable; using derived fallback.');
                            this.pendingLinearAccel = derived;
                        }
                        else {
                            this.pendingLinearAccel = sensorReading;
                        }
                    }
                    else {
                        this.pendingLinearAccel = sensorReading;
                    }
                    this.ensureRefreshTimer();
                });
                linearAccel.start();
            }
            else {
                console.log('LinearAccelerationSensor not available, using derived fallback values');
            }
            if (hasGyroscope) {
                const gyro = new Gyroscope({ frequency: 60 });
                gyro.addEventListener('reading', () => {
                    console.log('Gyroscope reading:', gyro.x, gyro.y, gyro.z);
                    this.pendingGyro = { x: gyro.x, y: gyro.y, z: gyro.z };
                    this.ensureRefreshTimer();
                });
                gyro.start();
            }
            else {
                console.log('Gyroscope not available, will show N/A');
                this.updateGyroscopeDisplay({ x: null, y: null, z: null });
            }
            accel.start();
            this.isListening = true;
            this.sensorContainer.classList.remove('hidden');
            this.visualizationButton.classList.remove('hidden');
            this.updateStatus('Sensors enabled (Generic API)', 'ready');
            this.enableButton.classList.add('hidden');
            this.sensorAPIEl.textContent = 'Generic Sensor API';
            this.currentMeasurement.sensorAPI = 'Generic Sensor API';
            this.startGPS();
            this.startHeadingListener();
        }
        catch (error) {
            console.error('Failed to start generic sensors:', error);
            this.updateStatus('Failed to start sensors', 'error');
        }
    }
    ensureRefreshTimer() {
        if (this.refreshTimer !== null) {
            return;
        }
        this.refreshTimer = window.setInterval(() => {
            let shouldSave = false;
            if (this.pendingLinearAccel) {
                this.updateLinearAccelerationDisplay(this.pendingLinearAccel);
                this.pendingLinearAccel = null;
                shouldSave = true;
            }
            if (this.pendingAccel) {
                this.updateAccelerometerDisplay(this.pendingAccel);
                this.pendingAccel = null;
                shouldSave = true;
            }
            if (this.pendingGyro) {
                this.updateGyroscopeDisplay(this.pendingGyro);
                this.pendingGyro = null;
                shouldSave = true;
            }
            if (this.pendingGPS) {
                this.updateGPSDisplay(this.pendingGPS);
                this.pendingGPS = null;
                shouldSave = true;
            }
            if (shouldSave && this.isRecording) {
                this.saveRecord(this.createMeasurementRecord());
            }
            this.updateVisualization();
        }, this.refreshIntervalMs);
    }
    updateLinearAccelerationDisplay(accel) {
        if (!accel)
            return;
        const x = typeof accel.x === 'number' ? accel.x.toFixed(2) : 'N/A';
        const y = typeof accel.y === 'number' ? accel.y.toFixed(2) : 'N/A';
        const z = typeof accel.z === 'number' ? accel.z.toFixed(2) : 'N/A';
        this.linearAccelDisplay.X.textContent = x;
        this.linearAccelDisplay.Y.textContent = y;
        this.linearAccelDisplay.Z.textContent = z;
        this.currentMeasurement.linearAccelX = typeof accel.x === 'number' ? accel.x : null;
        this.currentMeasurement.linearAccelY = typeof accel.y === 'number' ? accel.y : null;
        this.currentMeasurement.linearAccelZ = typeof accel.z === 'number' ? accel.z : null;
    }
    updateGPSDisplay(gps) {
        const latitude = gps && typeof gps.latitude === 'number' ? gps.latitude.toFixed(6) : 'N/A';
        const longitude = gps && typeof gps.longitude === 'number' ? gps.longitude.toFixed(6) : 'N/A';
        const accuracy = gps && typeof gps.accuracy === 'number' ? `${gps.accuracy.toFixed(1)} m` : 'N/A';
        this.gpsDisplay.latitude.textContent = latitude;
        this.gpsDisplay.longitude.textContent = longitude;
        this.gpsDisplay.accuracy.textContent = accuracy;
        this.currentMeasurement.gpsLat = gps && typeof gps.latitude === 'number' ? gps.latitude : null;
        this.currentMeasurement.gpsLon = gps && typeof gps.longitude === 'number' ? gps.longitude : null;
        this.currentMeasurement.gpsAcc = gps && typeof gps.accuracy === 'number' ? gps.accuracy : null;
    }
    startGPS() {
        if (!('geolocation' in navigator)) {
            this.updateGPSDisplay(null);
            return;
        }
        if (this.geoWatchId !== null) {
            return;
        }
        this.geoWatchId = navigator.geolocation.watchPosition((position) => {
            this.pendingGPS = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            };
            this.ensureRefreshTimer();
        }, (error) => {
            console.warn('GPS watch position failed:', error);
            this.updateGPSDisplay(null);
        }, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
        });
    }
    updateAccelerometerDisplay(accel) {
        if (!accel)
            return;
        const x = typeof accel.x === 'number' ? accel.x.toFixed(2) : 'N/A';
        const y = typeof accel.y === 'number' ? accel.y.toFixed(2) : 'N/A';
        const z = typeof accel.z === 'number' ? accel.z.toFixed(2) : 'N/A';
        this.accelDisplay.X.textContent = x;
        this.accelDisplay.Y.textContent = y;
        this.accelDisplay.Z.textContent = z;
        this.currentMeasurement.accelX = typeof accel.x === 'number' ? accel.x : null;
        this.currentMeasurement.accelY = typeof accel.y === 'number' ? accel.y : null;
        this.currentMeasurement.accelZ = typeof accel.z === 'number' ? accel.z : null;
    }
    updateGyroscopeDisplay(gyro) {
        if (!gyro)
            return;
        const x = typeof gyro.x === 'number' ? gyro.x.toFixed(2) : 'N/A';
        const y = typeof gyro.y === 'number' ? gyro.y.toFixed(2) : 'N/A';
        const z = typeof gyro.z === 'number' ? gyro.z.toFixed(2) : 'N/A';
        this.gyroDisplay.X.textContent = x;
        this.gyroDisplay.Y.textContent = y;
        this.gyroDisplay.Z.textContent = z;
        this.currentMeasurement.gyroX = typeof gyro.x === 'number' ? gyro.x : null;
        this.currentMeasurement.gyroY = typeof gyro.y === 'number' ? gyro.y : null;
        this.currentMeasurement.gyroZ = typeof gyro.z === 'number' ? gyro.z : null;
    }
    updateVisualization() {
        if (this.visualizationContainer.classList.contains('hidden'))
            return;
        const centerX = this.vizCanvas.width / 2;
        const centerY = this.vizCanvas.height / 2;
        const scale = 50; // pixels per m/s²
        const accelX = Math.round((this.currentMeasurement.linearAccelX || 0) * 10) / 10;
        const accelY = Math.round((this.currentMeasurement.linearAccelY || 0) * 10) / 10;
        const accelZ = Math.round((this.currentMeasurement.linearAccelZ || 0) * 10) / 10;
        const targetX = centerX - scale * accelX;
        const targetY = centerY - scale * accelY;
        const targetRadius = Math.max(5, Math.min(35, 20 - 2 * accelZ));
        // Spring physics
        const k = 5000; // stronger spring for very responsive movement
        const mass = 1;
        const damping = 0.1; // much less damping for quick response
        const dt = 0.016; // 16ms for 60fps
        // Spring force towards target
        const forceX = k * (targetX - this.pearlPos.x);
        const forceY = k * (targetY - this.pearlPos.y);
        // Update velocity
        this.pearlVel.x += (forceX / mass) * dt;
        this.pearlVel.y += (forceY / mass) * dt;
        // Apply damping
        this.pearlVel.x *= damping;
        this.pearlVel.y *= damping;
        // Update position
        this.pearlPos.x += this.pearlVel.x * dt;
        this.pearlPos.y += this.pearlVel.y * dt;
        // Clamp position to canvas bounds
        this.pearlPos.x = Math.max(targetRadius, Math.min(this.vizCanvas.width - targetRadius, this.pearlPos.x));
        this.pearlPos.y = Math.max(targetRadius, Math.min(this.vizCanvas.height - targetRadius, this.pearlPos.y));
        // Update radius (simple, no spring for radius)
        this.pearlRadius = targetRadius;
        // Draw
        this.vizCtx.clearRect(0, 0, this.vizCanvas.width, this.vizCanvas.height);
        this.vizCtx.fillStyle = 'white';
        this.vizCtx.fillRect(0, 0, this.vizCanvas.width, this.vizCanvas.height);
        this.vizCtx.beginPath();
        this.vizCtx.arc(this.pearlPos.x, this.pearlPos.y, this.pearlRadius, 0, 2 * Math.PI);
        this.vizCtx.fillStyle = `hsl(${this.currentHeading}, 100%, 45%)`;
        this.vizCtx.fill();
    }
    updateGravityEstimate(accel) {
        this.gravityEstimate.x = this.gravityAlpha * this.gravityEstimate.x + (1 - this.gravityAlpha) * accel.x;
        this.gravityEstimate.y = this.gravityAlpha * this.gravityEstimate.y + (1 - this.gravityAlpha) * accel.y;
        this.gravityEstimate.z = this.gravityAlpha * this.gravityEstimate.z + (1 - this.gravityAlpha) * accel.z;
    }
    deriveLinearAcceleration(accel) {
        return {
            x: accel.x - this.gravityEstimate.x,
            y: accel.y - this.gravityEstimate.y,
            z: accel.z - this.gravityEstimate.z,
        };
    }
    isSuspiciousLinearReading(sensor, derived) {
        const threshold = 1.5;
        const dx = Math.abs(sensor.x - derived.x);
        const dy = Math.abs(sensor.y - derived.y);
        const dz = Math.abs(sensor.z - derived.z);
        return dx > threshold || dy > threshold || dz > threshold;
    }
    async loadBuildNumber() {
        try {
            const response = await fetch('buildnr.txt', { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error('Failed to fetch build number');
            }
            const text = (await response.text()).trim();
            this.buildNumberEl.textContent = `Build #${text || 'unknown'}`;
        }
        catch (error) {
            console.error('Failed to load build number:', error);
            this.buildNumberEl.textContent = 'Build #unknown';
        }
    }
    startHeadingListener() {
        if (this.headingListening)
            return;
        this.headingListening = true;
        let hasAbsolute = false;
        // Android Chrome: deviceorientationabsolute gives alpha relative to geographic North
        window.addEventListener('deviceorientationabsolute', (event) => {
            hasAbsolute = true;
            if (event.alpha !== null) {
                this.updateHeadingDisplay(event.alpha);
            }
        });
        // iOS Safari: webkitCompassHeading is 0–360° clockwise from North
        // Also serves as fallback when deviceorientationabsolute is not fired
        window.addEventListener('deviceorientation', (event) => {
            if (hasAbsolute)
                return;
            if (typeof event.webkitCompassHeading === 'number') {
                this.updateHeadingDisplay(event.webkitCompassHeading);
            }
        });
    }
    updateHeadingDisplay(degrees) {
        this.currentHeading = degrees;
        const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(degrees / 45) % 8;
        this.headingDisplay.textContent = `${Math.round(degrees)}° ${cardinals[index]}`;
    }
    updateStatus(message, type) {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }
    showVisualization() {
        this.sensorContainer.classList.add('hidden');
        this.visualizationButton.classList.add('hidden');
        this.visualizationContainer.classList.remove('hidden');
        this.resizeCanvas();
    }
    showMainView() {
        this.visualizationContainer.classList.add('hidden');
        this.sensorContainer.classList.remove('hidden');
        this.visualizationButton.classList.remove('hidden');
    }
    resizeCanvas() {
        const container = this.visualizationContainer;
        const availableWidth = container.clientWidth - 40; // account for margins/padding
        const availableHeight = window.innerHeight - 200; // rough estimate for header/footer space
        const size = Math.min(availableWidth, availableHeight, 400); // max 400 to prevent too large
        this.vizCanvas.width = size;
        this.vizCanvas.height = size;
        // Reset pearl position to center
        this.pearlPos.x = size / 2;
        this.pearlPos.y = size / 2;
        this.pearlVel.x = 0;
        this.pearlVel.y = 0;
    }
}
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SensorViewer();
});
