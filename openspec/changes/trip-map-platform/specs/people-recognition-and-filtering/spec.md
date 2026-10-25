## ADDED Requirements

### Requirement: Automatic Face Detection and Clustering
The system SHALL detect faces in ingested images, store cropped face thumbnails in S3, and group similar faces into person clusters automatically.

#### Scenario: Detect and cluster faces on ingestion
- **WHEN** a photo containing one or more faces is ingested
- **THEN** the system extracts bounding boxes and facial embeddings, saves each face crop thumbnail to S3, and assigns each face to an existing matching person cluster or creates a new unnamed person cluster

### Requirement: Person Naming, Merging, and Dismissing Non-Person Clusters
The system SHALL allow users to assign names to face clusters, merge two clusters into a single person when they represent the same individual, and dismiss/delete false-positive or unwanted face clusters (e.g., paintings, statues, or background strangers) with confirmation while keeping the underlying travel photos intact.

#### Scenario: Name a person cluster
- **WHEN** the user assigns the name "Ricardo" to a person cluster (or merges another cluster into "Ricardo")
- **THEN** all photos associated with that cluster are tagged with "Ricardo" and searchable by that name

#### Scenario: Dismiss a false-positive face cluster
- **WHEN** the user clicks the delete/dismiss button on a face cluster (e.g., "Pessoa #6" from a painting) and confirms
- **THEN** the system removes the face detections and cropped avatars for that cluster from S3 and PostgreSQL without deleting the original photos

### Requirement: Multi-Person Boolean Filtering (AND / OR)
The system SHALL allow users to filter the map and gallery by selecting multiple people and choosing between `AND` (all selected people appear together in the same photo) and `OR` (at least one selected person appears).

#### Scenario: Filter photos where four specific people appear together
- **WHEN** the user selects "Ricardo", "Saulo", "Michele", and "Lorena" with the `AND` filter mode active
- **THEN** the map, timeline, and photo grid return only media items where all four selected individuals are present in the same photo
