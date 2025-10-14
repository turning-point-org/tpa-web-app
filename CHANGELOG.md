# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

