# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.3] - 2025-11-12

### Fixed
- **Scenario Planning Opportunity Explorer Layout**: Resolved layout issues in the Opportunity Explorer component
  - **Lifecycle Footer Visibility**: Fixed issue where the lifecycle footer was being pushed out of view by the flex-grow content area
    - Added `min-h-0` and `overflow-hidden` to the main content area to prevent it from exceeding its container
    - Added `flex-shrink-0` to the lifecycle footer to ensure it always maintains its 90px height
    - Removed `mt-auto` from footer as it's not needed with proper flex constraints
  - **Header Badge Overflow**: Fixed issue where span elements in the lifecycle header were getting cut off when text length grew
    - Changed layout from horizontal (`flex`) to vertical (`flex-col`) stacking
    - Added `whitespace-nowrap` to prevent text wrapping within each badge
    - Ensured each badge (points and cost) appears on its own line for better readability
    - Improved spacing with `gap-2` for consistent vertical spacing

### Technical Details
- Applied proper flexbox constraints to prevent content overflow
- Maintained responsive design while ensuring all content remains visible
- Improved layout stability for varying content lengths

## [2.3.2] - 2025-10-22

### Enhanced
- **CSV Export Functionality**: Improved DetailsModal CSV export for better data analysis and Excel compatibility
  - **Strategic Objectives Restructure**: Changed CSV format from concatenated strategic objectives to separate columns
    - Each strategic objective now appears as an individual column with numerical scores (1, 2, 3)
    - Removed semicolon-delimited concatenation for better data analysis
    - Dynamic column generation based on available strategic objectives
  - **Excel Character Encoding**: Fixed character display issues in Excel
    - Added UTF-8 BOM (Byte Order Mark) to CSV files for proper Excel encoding
    - Resolved apostrophe and special character corruption (e.g., 's → ‚Äôs)
    - Improved compatibility with Excel's default encoding detection

### Technical Improvements
- **Data Structure**: Enhanced CSV data organization for analytical workflows
  - Strategic objectives now appear as separate columns for independent analysis
  - Numerical scores enable mathematical operations and filtering
  - Consistent column ordering with alphabetical sorting
  - Empty cell handling for pain points without specific strategic objectives
- **File Compatibility**: Improved cross-platform file handling
  - UTF-8 BOM ensures proper character encoding across different systems
  - Better compatibility with Excel, Google Sheets, and other spreadsheet applications
  - Maintains backward compatibility with text editors and other CSV readers

## [2.3.1] - 2025-10-22
### Added
- New env variable "AZURE_OPENAI_LOW_LATENCY_CHAT_DEPLOYMENT_NAME" which contains the name of the low latency model being used

## [2.3.0] - 2025-10-22

### Added
- **AI-Powered Scoring Criteria Generation**: New functionality for automatically generating strategic objective scoring criteria
  - **Generate Scoring Criteria API**: New endpoint `/api/tenants/by-slug/workspaces/scans/generate-scoring-criteria` for AI-driven scoring criteria generation
    - Uses Azure OpenAI to generate contextually relevant low, medium, and high impact criteria
    - Incorporates company information, business lifecycles, and strategy documents for enhanced accuracy
    - Returns structured JSON with specific scoring criteria for each impact level
  - **Enhanced Add New Strategic Objective Modal**: Integrated scoring criteria generation within the objective creation workflow
    - Added scoring criteria text areas for Low Impact (Score: 1), Medium Impact (Score: 2), and High Impact (Score: 3)
    - "Generate Scoring Criteria" button with Wand2 icon for AI-powered generation
    - Loading spinners within each text input during generation process
    - Comprehensive error handling and user feedback
  - **Enhanced Edit Strategic Objective Modal**: Added AI-powered scoring criteria generation to existing objective editing
    - "Generate Scoring Criteria" button with Wand2 icon for regenerating criteria
    - Loading spinners within each scoring criteria text area during generation
    - Button disabled until both title and description are populated
    - Separate error handling and state management for edit modal
    - Consistent UI/UX with the Add New Strategic Objective modal

### Enhanced
- **Strategic Objectives UI/UX**: Improved user experience and visual consistency
  - **Button Component**: Enhanced disabled state styling for secondary and danger-secondary variants
    - Added proper disabled styling with gray borders, text, and background
    - Improved cursor behavior with `cursor-not-allowed` for disabled states
  - **Strategic Objective Cards**: Fixed vertical alignment of description text
    - Changed from vertically centered to top-left aligned for better readability
    - Improved card layout with proper flex positioning
  - **Generate Scoring Criteria Button**: Enhanced user interaction and validation
    - Button is disabled and greyed out until both title and description are populated
    - Visual feedback with loading state and proper disabled styling
    - Consistent purple color scheme matching app design system

### Technical Improvements
- **API Integration**: Enhanced context gathering for more accurate AI responses
  - Company information integration (name, industry, country, description, website)
  - Business lifecycles context for operational relevance
  - Business strategy documents integration for strategic alignment
  - Improved prompt engineering for better scoring criteria generation
- **Error Handling**: Comprehensive error handling and user feedback
  - Proper error states and user notifications
  - Graceful fallbacks for API failures
  - Clear validation messages and loading states

## [2.2.0] - 2025-10-17

### Added
- **Historical Data Migration System**: Comprehensive migration tools for updating existing lifecycle documents
  - **Migration Script**: `migrate-process-groups-volumetrics.js` for adding volumetric metrics to historical process groups
    - Command-line interface with multiple options (dry-run, tenant-specific, batch processing, verbose logging)
    - Automatic detection of missing volumetric metrics (aht, cycleTime, headcount, cost)
    - Idempotent operation - safe to run multiple times without data duplication
    - Batch processing with configurable batch sizes to prevent database overload
    - Comprehensive error handling and detailed progress reporting
  - **Backup System**: `backup-lifecycles.js` for creating data exports before migration
    - Full lifecycle document export with metadata and filtering options
    - Tenant-specific backup capability
    - JSON format with timestamp and source information
    - File size reporting and document count validation
  - **Documentation Suite**: Complete guides for backup and migration procedures
    - `BACKUP-AND-MIGRATION-GUIDE.md`: Step-by-step workflow for safe data migration
    - `README.md`: Detailed usage instructions and safety features
    - Azure deployment instructions and rollback procedures

### Enhanced
- **Data Consistency**: Ensured all process groups have consistent volumetric metrics structure
  - Default values: aht = {value: 0, unit: "min", base_minutes: 0}, cycleTime = {value: 0, unit: "min", base_minutes: 0}, headcount = 0, cost = 0
  - Migration script handles both missing fields and null/undefined values
- **Production Safety**: Multiple backup and rollback options for safe production deployment
  - Continuous backup setup instructions for Azure Cosmos DB
  - Manual data export capabilities
  - Dry-run testing mode for validation before execution
  - Comprehensive error handling and logging

### Technical Details
- **Migration Architecture**: Modular design with separate concerns for detection, validation, and execution
- **Command-Line Interface**: Professional CLI with help system and multiple configuration options
- **Azure Integration**: Optimized for Azure App Service deployment with environment variable support
- **Performance Optimization**: Batch processing and rate limiting to prevent database throttling
- **Audit Trail**: Detailed logging with timestamps and progress tracking
- **Error Recovery**: Graceful handling of individual failures with continuation of batch processing

## [2.1.0] - 2025-10-15

### Added
- **Volumetric Data Management**: Comprehensive volumetric metrics system for process groups and categories
  - **Process Group Creation**: Enhanced "Create New Process Group" modal with volumetric data input fields
    - Average Handling Time (AHT) with unit selection (Minutes, Hours, Days)
    - Cycle Time with unit selection (Minutes, Hours, Days)
    - Headcount with positive integer validation
    - Cost with positive integer validation and dollar formatting
  - **Process Group Editing**: Updated "Edit Process Group" modal with full volumetric data editing capabilities
  - **Automatic Base Minutes Calculation**: Real-time conversion of time units to standardized base_minutes
    - Minutes: `base_minutes = value`
    - Hours: `base_minutes = value * 60`
    - Days: `base_minutes = value * 60 * 24`
  - **Category-Level Aggregation**: New calculation functions for process categories
    - `calculateCategoryHeadcount()`: Sums headcount across all process groups in a category
    - `calculateCategoryCost()`: Sums cost across all process groups in a category
    - `calculateCategoryAHT()`: Aggregates and formats total Average Handling Time
    - `calculateCategoryCycleTime()`: Aggregates and formats total Cycle Time
  - **Time Formatting**: Smart time display formatting (e.g., "1d 2h 15min", "3h 30min", "45min")
  - **Toggle Controls**: Individual toggle switches for each volumetric metric type (AHT, Cycle Time, Headcount, Cost)
    - Metrics hidden by default, controllable via menu dropdown
    - Independent visibility control for scores vs. volumetric metrics

### Enhanced
- **ProcessMetric Component**: Updated to support separate `value` and `unit` props for better data handling
  - **Pluralization Logic**: Added intelligent pluralization for time units (hour/hours, day/days, minute/minutes)
  - **Grid Layout**: Implemented 2-column grid layout for ProcessMetric components in process groups
- **UI Layout Improvements**: 
  - Compact input layout with unit dropdowns positioned to the right of value inputs
  - Responsive design for volumetric data input fields
  - Consistent styling across create and edit modals
  - **Process Category Cards**: Increased width from `w-64` to `w-72` for better text display
  - **Grid Layout**: Applied 2-column grid layout for ProcessMetric components
- **Data Persistence**: Full CosmosDB integration for volumetric data storage and retrieval
- **Input Validation**: Client-side validation ensuring positive integer values for all numeric inputs
- **Edit Modal Enhancement**: Added comprehensive volumetric metrics display section in read-only view
  - 2x2 grid layout showing AHT, Cycle Time, Headcount, and Cost
  - Clear "Not set" indicators for missing values
  - Consistent styling with existing modal design

### Fixed
- **CosmosDB Integration**: Resolved issue where volumetric data wasn't being saved during process group updates
  - Updated API route to handle all volumetric fields in `update_group` action
  - Added proper field mapping for AHT, Cycle Time, Headcount, and Cost
- **Data Consistency**: Ensured volumetric data persists across page refreshes and sessions
- **State Management**: Fixed local state updates to include all volumetric fields
- **Input Field Clearing**: Addressed issue where default '0' values in volumetric input fields could not be removed
  - Implemented separate display state for input fields to allow visual clearing while maintaining numeric data state
  - Applied fix to both "Create New Process Group" and "Edit Process Group" modals
- **Text Wrapping**: Resolved text wrapping issues in ProcessMetric components
  - Increased process category card width to provide more space for metric text
  - Implemented grid layout for better space utilization

### Technical Details
- **Database Schema**: Extended lifecycle documents to include volumetric data structure
- **API Endpoints**: Enhanced lifecycle management endpoints to handle volumetric data
- **Type Safety**: Updated TypeScript interfaces to include volumetric data properties
- **Error Handling**: Robust error handling for missing or invalid volumetric data
- **Performance**: Efficient aggregation calculations with proper null/undefined handling

## [2.0.0] - 2025-10-14

### Fixed
- **Horizontal Overflow Issue**: Resolved critical layout issue where the LifecycleViewer component would extend beyond the viewport width when multiple process category cards were added
  - Fixed `MainContent.tsx`: Added `overflow-x-hidden` and `max-w-full` to the main content area to prevent horizontal expansion
  - Fixed `page.tsx` (lifecycle detail page): Added width constraints (`w-full max-w-full overflow-hidden`) to parent container
  - Fixed `LifecycleViewer.tsx`: 
    - Added `w-full max-w-full` constraints to outer containers
    - Wrapped TransformWrapper in a constrained div with `overflow-hidden` and fixed height
    - Updated TransformComponent contentStyle to use `inline-flex` with `flex-start` alignment instead of forcing full width
    - This allows users to pan/zoom to view all category cards without causing page-wide horizontal scrolling

### Technical Details
- Implemented multiple layers of overflow protection at different component levels
- Maintained zoom/pan functionality while preventing viewport overflow
- Solution is responsive and works across different screen sizes
- Fixed width remains consistent regardless of the number of process categories added

