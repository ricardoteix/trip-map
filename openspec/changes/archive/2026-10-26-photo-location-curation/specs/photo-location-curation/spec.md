## ADDED Requirements

### Requirement: Lightbox Location Editor
The system SHALL provide an inline location editor within the Lightbox sidebar for the currently displayed media item, allowing the user to view exact coordinates, search for places, and update location attributes without closing the viewer.

#### Scenario: Open location editor in Lightbox
- **WHEN** user clicks the "Editar Local" button in the Lightbox sidebar
- **THEN** the sidebar displays inputs for custom location name, place search, decimal latitude, and decimal longitude

#### Scenario: Save updated location
- **WHEN** user enters or selects new coordinates and clicks "Salvar Local"
- **THEN** the system calls the location update API, refreshes the media item, and updates the display in the Lightbox and map

### Requirement: Main Map Coordinate Picker with Return Flow
The system SHALL allow the user to adjust photo coordinates using the full-screen interactive main map, suspending the Lightbox view and automatically restoring it once coordinates are chosen.

#### Scenario: Pick coordinates on main map from Lightbox
- **WHEN** user clicks "Ajustar no Mapa" in the Lightbox location editor
- **THEN** the Lightbox modal is temporarily hidden, the main map enters pick mode with a crosshair cursor and banner, and clicking the map picks the coordinates and restores the Lightbox with the new values filled in

### Requirement: Coordinate Clipboard and Shortcuts
The system SHALL provide a session-based location clipboard enabling one-click copy and paste of geographical coordinates and location names between photos using UI buttons or keyboard shortcuts.

#### Scenario: Copy location via shortcut or button
- **WHEN** user presses `Ctrl + C` (or `Cmd + C`) in the Lightbox or clicks the "Copiar Local" button
- **THEN** the current photo's latitude, longitude, and custom location name are saved to the clipboard, and a toast confirms the copy

#### Scenario: Paste location via shortcut or button
- **WHEN** user presses `Ctrl + V` (or `Cmd + V`) while viewing another photo in the Lightbox with a copied location in memory
- **THEN** the system applies the copied coordinates and custom location name to the current photo, persists the change, and shows a confirmation toast

### Requirement: Custom Location Name
The system SHALL support assigning a custom descriptive location label (such as a trail, attraction, or business name) to any media item, while preserving resolved city and country metadata.

#### Scenario: Set custom attraction name
- **WHEN** user sets the location name to "Cachoeira do Buracão" and saves
- **THEN** the media item displays "Cachoeira do Buracão" as the primary location label with resolved city "Ibicoara, Brasil" as the subtitle
