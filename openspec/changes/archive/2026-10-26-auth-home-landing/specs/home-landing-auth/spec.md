## ADDED Requirements

### Requirement: Welcome Home Landing Screen for Unauthenticated Visitors
The system SHALL display a dedicated welcome/home landing screen whenever an unauthenticated visitor accesses the application root, featuring the brand logo, a tagline, and a prominent Google sign-in action.

#### Scenario: Unauthenticated visitor visits the application
- **WHEN** a visitor accesses the application and `currentUser` is null
- **THEN** the system displays the dedicated Home Landing screen with logo, product description, and "Entrar com Google" button instead of the full map dashboard and toolbar

### Requirement: Contextual Trip Invitation on Home Landing
The system SHALL display an invitation banner on the Home Landing screen when a visitor accesses the application with a valid trip invitation token, prompting them to sign in to access and collaborate.

#### Scenario: Visitor arrives via trip invitation link
- **WHEN** a visitor arrives via a URL containing a `joinToken`
- **THEN** the Home Landing screen presents a prominent card displaying the invitation context and guiding the user to sign in with Google to view and collaborate on the trip

### Requirement: Smooth Transition upon Authentication
The system SHALL transition automatically to the main interactive map workspace once authentication is verified without requiring manual page reload.

#### Scenario: User successfully logs in
- **WHEN** the user completes the Google OAuth flow and `currentUser` becomes available
- **THEN** the Home Landing screen is dismissed and the full interactive map dashboard, trips panel, and timeline are loaded
