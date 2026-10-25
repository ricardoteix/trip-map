## ADDED Requirements

### Requirement: Automated Spatio-Temporal Trip Grouping
The system SHALL automatically group geotagged media into Trips/Moments based on chronological continuity and geographic proximity, generating human-readable location titles via offline reverse geocoding.

#### Scenario: Automatically create a trip from travel photos
- **WHEN** geotagged photos are ingested or re-grouped
- **THEN** the system clusters consecutive photos within the configured time and distance thresholds into a Trip, resolves the primary city and country, and displays a Trip card with cover photo, date range, photo count, and route preview on the map

### Requirement: Manual Trip Creation, Naming, Merging, and Photo Assignment
The system SHALL allow users to assign a Trip during upload/folder import, rename existing Trips, merge multiple Trips into one, create a Trip from a date range (including untagged photos), and batch-assign selected gallery photos to an existing or new Trip, preserving manual Trip assignments across automatic regrouping.

#### Scenario: Merge or rename trips and assign photos in batch
- **WHEN** the user renames a Trip, merges two Trips, creates a Trip by date range, or assigns selected photos to a Trip
- **THEN** the system locks those Trip assignments as manual (`is_manual`), recalculates the Trip date bounds, center coordinates, and photo counts, and updates the UI immediately

### Requirement: Trip Outings / Specific Places Subgroups (Passeios & Locais)
The system SHALL support a second-level grouping of Outings / Specific Places (e.g., "Cachoeira do Buracão" in "Ibicoara-BA") within Trips, automatically clustering stops by tight geographic proximity (~3.5 km) and allowing users to rename outings, merge outings, or assign selected photos / clicked map clusters to a named outing for instant filtering and map pin labeling.

#### Scenario: Filter and label photos by Outing / Specific Place
- **WHEN** the user selects an Outing chip (or names a map cluster / gallery selection as "Cachoeira do Buracão" in "Ibicoara-BA")
- **THEN** the map pins display "Cachoeira do Buracão", the gallery and timeline filter to that specific outing, and the camera flies to the outing coordinates
