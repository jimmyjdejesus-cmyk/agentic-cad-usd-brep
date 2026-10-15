## 2024-05-15 - Initial Journal

## 2024-05-15 - ARIA Labels on Toggle Buttons
**Learning:** Icon-only accordion toggles often rely solely on visual cues (like ChevronUp/Down) which screen readers cannot interpret without explicit text. In standard React components, adding dynamic `aria-label` based on state (e.g., Expanded/Collapsed) makes the interaction significantly more accessible.
**Action:** Always add state-dependent `aria-label` to icon-only disclosure buttons to explain both the action and current state for assistive technology.
