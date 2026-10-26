## 1. Lightbox Location Editor Component

- [x] 1.1 Add location editor panel in `LightboxModal.tsx` with fields for custom location name, Nominatim place search, decimal latitude, and decimal longitude
- [x] 1.2 Wire save handler to update photo coordinates and custom name via `onUpdateLocation` prop

## 2. Main Map Coordinate Picker Round-Trip

- [x] 2.1 Add "Ajustar no Mapa" action in `LightboxModal.tsx` triggering map pick mode in `App.tsx`
- [x] 2.2 Implement Lightbox suspend/restore flow in `App.tsx` and banner notification in `MapView.tsx` when picking coordinates for a photo

## 3. Coordinate Clipboard & Keyboard Shortcuts

- [x] 3.1 Implement session-based coordinate clipboard in `App.tsx` and pass copy/paste handlers to `LightboxModal.tsx`
- [x] 3.2 Add `Ctrl + C` (copy location) and `Ctrl + V` (paste location) keyboard shortcut handlers with toast feedback and input guards

## 4. Verification and Build

- [x] 4.1 Rebuild frontend container and verify single-photo location editing, map picking round-trip, and copy/paste shortcuts
