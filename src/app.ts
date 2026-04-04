class SensorViewer {
  private statusEl: HTMLElement;
  private enableButton: HTMLButtonElement;
  private sensorContainer: HTMLElement;
  private linearAccelDisplay: Record<string, HTMLElement>;
  private accelDisplay: Record<string, HTMLElement>;
  private gyroDisplay: Record<string, HTMLElement>;
  private buildNumberEl: HTMLElement;
  private sensorAPIEl: HTMLElement;
  private accelAvailableEl: HTMLElement;
  private gyroAvailableEl: HTMLElement;
  private linearAccelAvailableEl: HTMLElement;
  private isListening: boolean = false;
  private pendingLinearAccel: any = null;
  private pendingAccel: any = null;
  private pendingGyro: any = null;
  private lastAccelReading: { x: number; y: number; z: number } | null = null;
  private gravityEstimate = { x: 0, y: 0, z: 0 };
  private readonly gravityAlpha = 0.8;
  private refreshTimer: number | null = null;
  private readonly refreshIntervalMs = 800;

  constructor() {
    this.statusEl = this.getElementById('status');
    this.enableButton = this.getElementById('enableButton') as HTMLButtonElement;
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

    this.buildNumberEl = this.getElementById('buildNumber');
    this.loadBuildNumber();

    this.sensorAPIEl = this.getElementById('sensorAPI');
    this.accelAvailableEl = this.getElementById('accelAvailable');
    this.gyroAvailableEl = this.getElementById('gyroAvailable');
    this.linearAccelAvailableEl = this.getElementById('linearAccelAvailable');

    this.setupEventListeners();
    this.checkDeviceMotionPermission();
  }

  private getElementById(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id "${id}" not found`);
    }
    return element;
  }

  private setupEventListeners(): void {
    this.enableButton.addEventListener('click', () => this.requestSensorPermission());
  }

  private checkDeviceMotionPermission(): void {
    // Check sensor availability
    const hasDeviceMotion = typeof DeviceMotionEvent !== 'undefined';
    const hasDeviceMotionPermission = hasDeviceMotion && typeof (DeviceMotionEvent as any).requestPermission === 'function';
    const hasAccelerometer = typeof Accelerometer !== 'undefined';
    const hasGyroscope = typeof Gyroscope !== 'undefined';
    const hasLinearAcceleration = typeof (globalThis as any).LinearAccelerationSensor !== 'undefined';

    console.log('Sensor availability:', {
      hasDeviceMotion,
      hasDeviceMotionPermission,
      hasAccelerometer,
      hasGyroscope,
      hasLinearAcceleration,
      'typeof DeviceMotionEvent': typeof DeviceMotionEvent,
      'typeof Accelerometer': typeof Accelerometer,
      'typeof Gyroscope': typeof Gyroscope,
      'typeof LinearAccelerationSensor': typeof (globalThis as any).LinearAccelerationSensor
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
    } else if (hasDeviceMotion) {
      // Fallback to older DeviceMotionEvent API
      this.updateStatus('Sensors available. Tap button to enable.', 'waiting');
    } else {
      this.updateStatus(
        'Sensors not supported on this device/browser',
        'error'
      );
      this.enableButton.disabled = true;
    }
  }

  private async requestSensorPermission(): Promise<void> {
    try {
      // Try modern Sensor API first (iOS 13+)
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof (DeviceMotionEvent as any).requestPermission === 'function'
      ) {
        const permissionAccel = await (
          DeviceMotionEvent as any
        ).requestPermission();
        const permissionGyro = await (
          DeviceMotionEvent as any
        ).requestPermission();

        if (permissionAccel === 'granted' && permissionGyro === 'granted') {
          this.startListeningModern();
        } else {
          this.updateStatus('Permission denied', 'error');
        }
      } else if (typeof Accelerometer !== 'undefined') {
        // Generic Sensor API
        this.startListeningGenericSensor();
      } else {
        // Fallback to older DeviceMotionEvent (no permission request needed)
        this.startListeningDeviceMotion();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      this.updateStatus(
        'Permission request failed: ' + (error instanceof Error ? error.message : String(error)),
        'error'
      );
    }
  }

  private startListeningModern(): void {
    this.isListening = true;
    this.sensorContainer.classList.remove('hidden');
    this.updateStatus('Sensors enabled', 'ready');
    this.enableButton.disabled = true;
    this.enableButton.textContent = 'Sensors Active';
    this.sensorAPIEl.textContent = 'DeviceMotionEvent (iOS)';

    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
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
  }

  private startListeningDeviceMotion(): void {
    this.isListening = true;
    this.sensorContainer.classList.remove('hidden');
    this.updateStatus('Sensors enabled (legacy mode)', 'ready');
    this.enableButton.disabled = true;
    this.enableButton.textContent = 'Sensors Active';
    this.sensorAPIEl.textContent = 'DeviceMotionEvent (Legacy)';

    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
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
  }

  private startListeningGenericSensor(): void {
    try {
      const hasGyroscope = typeof Gyroscope !== 'undefined';
      const hasLinearAcceleration = typeof (globalThis as any).LinearAccelerationSensor !== 'undefined';

      console.log('Starting Generic Sensor API with available sensors:', {
        Accelerometer: true,
        Gyroscope: hasGyroscope,
        LinearAcceleration: hasLinearAcceleration
      });

      const accel = new (Accelerometer as any)({ frequency: 60 });

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
        const LinearAccelerationCtor = (globalThis as any).LinearAccelerationSensor;
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
            } else {
              this.pendingLinearAccel = sensorReading;
            }
          } else {
            this.pendingLinearAccel = sensorReading;
          }
          this.ensureRefreshTimer();
        });
        linearAccel.start();
      } else {
        console.log('LinearAccelerationSensor not available, using derived fallback values');
      }

      if (hasGyroscope) {
        const gyro = new (Gyroscope as any)({ frequency: 60 });
        gyro.addEventListener('reading', () => {
          console.log('Gyroscope reading:', gyro.x, gyro.y, gyro.z);
          this.pendingGyro = { x: gyro.x, y: gyro.y, z: gyro.z };
          this.ensureRefreshTimer();
        });
        gyro.start();
      } else {
        console.log('Gyroscope not available, will show N/A');
        // Mark gyroscope as not available
        this.updateGyroscopeDisplay({ x: null, y: null, z: null });
      }

      accel.start();

      this.isListening = true;
      this.sensorContainer.classList.remove('hidden');
      this.updateStatus('Sensors enabled (Generic API)', 'ready');
      this.enableButton.disabled = true;
      this.enableButton.textContent = 'Sensors Active';
      this.sensorAPIEl.textContent = 'Generic Sensor API';
    } catch (error) {
      console.error('Failed to start generic sensors:', error);
      this.updateStatus('Failed to start sensors', 'error');
    }
  }

  private ensureRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      return;
    }

    this.refreshTimer = window.setInterval(() => {
      if (this.pendingLinearAccel) {
        this.updateLinearAccelerationDisplay(this.pendingLinearAccel);
        this.pendingLinearAccel = null;
      }
      if (this.pendingAccel) {
        this.updateAccelerometerDisplay(this.pendingAccel);
        this.pendingAccel = null;
      }
      if (this.pendingGyro) {
        this.updateGyroscopeDisplay(this.pendingGyro);
        this.pendingGyro = null;
      }
    }, this.refreshIntervalMs);
  }

  private updateLinearAccelerationDisplay(accel: any): void {
    if (!accel) return;
    const x = typeof accel.x === 'number' ? accel.x.toFixed(2) : 'N/A';
    const y = typeof accel.y === 'number' ? accel.y.toFixed(2) : 'N/A';
    const z = typeof accel.z === 'number' ? accel.z.toFixed(2) : 'N/A';
    this.linearAccelDisplay.X.textContent = x;
    this.linearAccelDisplay.Y.textContent = y;
    this.linearAccelDisplay.Z.textContent = z;
  }

  private updateAccelerometerDisplay(accel: any): void {
    if (!accel) return;
    const x = typeof accel.x === 'number' ? accel.x.toFixed(2) : 'N/A';
    const y = typeof accel.y === 'number' ? accel.y.toFixed(2) : 'N/A';
    const z = typeof accel.z === 'number' ? accel.z.toFixed(2) : 'N/A';
    this.accelDisplay.X.textContent = x;
    this.accelDisplay.Y.textContent = y;
    this.accelDisplay.Z.textContent = z;
  }

  private updateGyroscopeDisplay(gyro: any): void {
    if (!gyro) return;
    const x = typeof gyro.x === 'number' ? gyro.x.toFixed(2) : 'N/A';
    const y = typeof gyro.y === 'number' ? gyro.y.toFixed(2) : 'N/A';
    const z = typeof gyro.z === 'number' ? gyro.z.toFixed(2) : 'N/A';
    this.gyroDisplay.X.textContent = x;
    this.gyroDisplay.Y.textContent = y;
    this.gyroDisplay.Z.textContent = z;
  }

  private updateGravityEstimate(accel: { x: number; y: number; z: number }): void {
    this.gravityEstimate.x = this.gravityAlpha * this.gravityEstimate.x + (1 - this.gravityAlpha) * accel.x;
    this.gravityEstimate.y = this.gravityAlpha * this.gravityEstimate.y + (1 - this.gravityAlpha) * accel.y;
    this.gravityEstimate.z = this.gravityAlpha * this.gravityEstimate.z + (1 - this.gravityAlpha) * accel.z;
  }

  private deriveLinearAcceleration(accel: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
      x: accel.x - this.gravityEstimate.x,
      y: accel.y - this.gravityEstimate.y,
      z: accel.z - this.gravityEstimate.z,
    };
  }

  private isSuspiciousLinearReading(sensor: { x: number; y: number; z: number }, derived: { x: number; y: number; z: number }): boolean {
    const threshold = 1.5;
    const dx = Math.abs(sensor.x - derived.x);
    const dy = Math.abs(sensor.y - derived.y);
    const dz = Math.abs(sensor.z - derived.z);
    return dx > threshold || dy > threshold || dz > threshold;
  }

  private async loadBuildNumber(): Promise<void> {
    try {
      const response = await fetch('buildnr.txt', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('Failed to fetch build number');
      }
      const text = (await response.text()).trim();
      this.buildNumberEl.textContent = `Build #${text || 'unknown'}`;
    } catch (error) {
      console.error('Failed to load build number:', error);
      this.buildNumberEl.textContent = 'Build #unknown';
    }
  }

  private updateStatus(message: string, type: 'waiting' | 'ready' | 'error'): void {
    this.statusEl.textContent = message;
    this.statusEl.className = `status ${type}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SensorViewer();
});
