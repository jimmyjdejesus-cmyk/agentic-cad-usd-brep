## 2026-10-15 - Initial Journal

## 2026-10-15 - ARIA Labels on Toggle Buttons
**Learning:** Icon-only accordion toggles often rely solely on visual cues (like ChevronUp/Down) which screen readers cannot interpret without explicit text. In standard React components, adding dynamic `aria-label` based on state (e.g., Expanded/Collapsed) makes the interaction significantly more accessible.
**Action:** Always add state-dependent `aria-label` to icon-only disclosure buttons to explain both the action and current state for assistive technology.

## 2026-10-15 - CAM Studio Modal WAI-ARIA Tabs & Input Unit Descriptions
**Learning:** Complex multi-tab modal interfaces (like CAM & CNC toolpath generation) require structured keyboard navigation and context announcements. Associating form inputs with unit labels via `aria-describedby` (e.g. `mm/min`, `RPM`) provides essential context to screen reader users when adjusting technical machining parameters. Using `role="tablist"` with arrow-key event handling enables standard WAI-ARIA tab navigation, while `aria-live="polite"` status regions ensure real-time status updates (like G-Code generation or STL downloads) are announced without interrupting user input.
**Action:** Always implement the WAI-ARIA tablist pattern with arrow-key focus management on tab bars, link unit descriptions using `aria-describedby`, and provide `aria-live="polite"` status announcements for async file post-processing or downloads.
