# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

