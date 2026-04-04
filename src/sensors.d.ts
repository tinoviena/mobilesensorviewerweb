interface SensorOptions {
  frequency?: number;
}

declare class Accelerometer extends EventTarget {
  x: number;
  y: number;
  z: number;
  constructor(options?: SensorOptions);
  start(): void;
  stop(): void;
}

declare class Gyroscope extends EventTarget {
  x: number;
  y: number;
  z: number;
  constructor(options?: SensorOptions);
  start(): void;
  stop(): void;
}
