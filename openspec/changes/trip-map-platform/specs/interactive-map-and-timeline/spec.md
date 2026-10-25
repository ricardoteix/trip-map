## ADDED Requirements

### Requirement: Light-Themed Interactive Photo Map with Clustering
The system SHALL display geotagged media on an interactive MapLibre GL map defaulting to a clean Light Mode base style, grouping nearby items into Apple Photos-style thumbnail clusters with item counts.

#### Scenario: View clustered photos on the map
- **WHEN** the user opens the map view or changes the zoom level
- **THEN** the map groups nearby photos using spatial clustering, displaying a square thumbnail preview of the cluster's cover photo with a count badge, and clicking a cluster zooms in or opens the photos in that cluster

### Requirement: Interactive Timeline Range Filter and Route Playback
The system SHALL provide an interactive timeline bar with an activity histogram, date range handles, granularity toggle between Month (`month`) and Day (`day`), automatic zoom into daily buckets when selecting a Trip or when few months exist, and chronological route visualization.

#### Scenario: Filter map markers by dragging timeline range
- **WHEN** the user adjusts the start and end dates on the timeline slider or switches between `Dia` and `Mês` granularity
- **THEN** the map and photo gallery immediately filter to show only media captured within the selected date range, grouped by day in the gallery, and optionally render a chronological route line connecting the filtered locations

### Requirement: Batch Manual Geotagging
The system SHALL allow users to assign or update geographic coordinates for one or multiple media items simultaneously.

#### Scenario: Assign location to untagged photos
- **WHEN** the user selects one or more photos and chooses a location on the map or searches for a city name
- **THEN** the system updates the latitude, longitude, and reverse-geocoded city/country for all selected media items and immediately displays them on the map

### Requirement: Lightbox Sequential Navigation and Curation
The system SHALL allow users to navigate sequentially (Next/Previous) through the active gallery or map-cluster media list directly inside the Lightbox modal using on-screen controls or keyboard arrow keys, preloading adjacent images and automatically advancing to the adjacent item when the currently viewed item is deleted.

#### Scenario: Navigate between images in Lightbox
- **WHEN** the user opens an image in the Lightbox and clicks the Next/Previous buttons or presses the `ArrowRight` / `ArrowLeft` keys
- **THEN** the Lightbox transitions immediately to the next or previous item in the active gallery list, displays the current position index (e.g., `14 / 290`), and preloads adjacent images

#### Scenario: Delete image while browsing in Lightbox
- **WHEN** the user deletes the currently opened image inside the Lightbox
- **THEN** the system deletes the item and automatically advances the Lightbox to the next available item in the list (or the previous item if at the end), closing only when no items remain
