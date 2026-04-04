# Mobile Sensor Viewer

A simple web app to display accelerometer and gyroscope sensor values from mobile devices.

## Features

- ✅ Displays accelerometer (X, Y, Z) values
- ✅ Displays gyroscope (X, Y, Z) values
- ✅ Requests user consent before accessing sensors
- ✅ Mobile-friendly design optimized for Android
- ✅ Pure frontend - no backend required
- ✅ Minimal dependencies
- ✅ Written in TypeScript

## Requirements

- Node.js (for development/building)
- Modern mobile browser with sensor API support:
  - iOS 13+ (Safari)
  - Android 5.0+ (Chrome, Firefox)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. For development with watch mode:
```bash
npm run dev
```

4. Serve locally:
```bash
npm run serve
```

Then visit `http://localhost:8080` on your device or `http://<your-ip>:8080` from another device.

## How to Use

1. Open the app on your mobile device
2. Tap the **"Enable Sensors"** button
3. Grant permission when prompted
4. The app will display real-time sensor readings

## API Support

- **Modern Sensors API**: Uses the Generic Sensor API when available
- **DeviceMotionEvent**: Fallback for older browsers and Android devices
- **iOS 13+**: Requires explicit permission request via `DeviceMotionEvent.requestPermission()`

## Browser Support

- ✅ Safari on iOS 13+
- ✅ Chrome on Android 5+
- ✅ Firefox on Android
- ⚠️ Other browsers may have limited or no sensor support

## Notes

- Sensor availability varies by device and browser
- Sensors may not be available in some browser contexts (iframes, etc.)
- Some devices may require HTTPS for sensor API access
