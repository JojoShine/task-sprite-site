# Task Sprite visual and interaction QA

final result: passed

## Target and evidence

- Source: design-concepts/01-home-v2.png, 02-plans-v2.png, 03-download-v2.png (1536 × 1024 each).
- Final direction: user changed the three independent pages into one vertically scrolling page, in the same order. One sticky navigation and one footer replace the repeated chrome.
- Browser evidence: qa/scroll-desktop.jpg (1521 × 2833), qa/scroll-mobile.jpg (375 × 3758), qa/preview.jpg.
- Desktop CSS viewport 1536 × 1024; captured content width 1521 after the native 15px scrollbar. Image density 1:1 CSS pixels. Mobile CSS viewport 390 × 844; captured content width 375 after the scrollbar.
- Combined source/implementation evidence: qa/comparison-final.jpg, rendered together by qa/compare.html. Focused task-card/character comparison: qa/comparison-detail.jpg. Initial comparison: qa/comparison.jpg.
- Default state: robot selected, current task 完成方案初稿, three pending and one overdue.

## Findings and corrections

1. Mobile demo controls initially wrapped the pager and reset labels. Fixed with non-wrapping, intrinsic-width flex controls; re-captured and confirmed in final mobile evidence.
2. Characters initially floated above the baseline. Adjusted sprite placement to align feet with the baseline; confirmed in desktop and mobile screenshots.
3. The plans heading initially left a single character on a line. Grouped its two phrases into inline blocks; final mobile image shows two intentional lines.
4. Final layout changed per user instruction: removed the standalone routes, scoped IDs and events to each demo, added native vertical scrolling, sticky navigation, anchor offsets and current-section tracking. Browser confirms no duplicate IDs and both demos work.

## Fidelity surfaces

- Typography: system Chinese sans; 48px desktop hero, 16–18px body and 44px main actions. This follows the requested normal web proportions. Mobile type scales and paragraphs wrap without truncation.
- Spacing: centered hero, two comparison columns, editorial download split. Mobile stacks columns. Section separators and breathing room connect the former pages, without repeating navigation/footer.
- Colors: warm ivory #f7f7f0, charcoal #30352f, muted olive #606e4f, muted red overdue count. Pixel outlines and restrained offset shadows remain.
- Assets: original transparent pixel sprite atlases and original brand SVG reused. Existing Phosphor icons reused. No placeholder images or screenshot-as-page implementation. Native character identities remain consistent across animations.
- Copy: free local capabilities, planned annual benefits, three-computer allowance, disabled download/payment status and undetermined prices retained. “多设备协作” clarified as personal synchronization.

## Browser verification

- 320, 390, 768 and 1440 CSS-pixel widths: no horizontal overflow; vertical content heights 4004, 3758, 2837 and 2833 respectively.
- One h1; IDs unique; images loaded.
- Header anchors scroll to the correct sections. At desktop download anchor: target top 104.875px, header bottom 76px; current nav becomes #download.
- Task paging, completion, overdue decrement, all-completed state, reset, selection, second-tap feedback verified.
- Both demos retested after merging: completing download tasks does not change the home demo; reset restores three tasks. Escape closes the panel and returns focus to its trigger.
- Browser warning/error logs empty.
- JavaScript syntax check, static asset/link validation and production build passed.

## Follow-up polish

P3: the generated references have small raster sparkle/grass accents and a paper grain. The implementation uses the existing original character/brand assets and a flat warm paper background; these cosmetic accents are not reproduced. The reference uses chunkier generated icon silhouettes; implementation preserves the existing icon library.

## Checklist

- [x] Continuous scroll and anchor navigation
- [x] Two independent working sprite/task demos
- [x] Desktop/mobile visual evidence and combined comparison
- [x] No P0/P1/P2 findings remain
- [x] Local checks/build; no external publication requested

## Focused alignment correction after user review

The earlier pass missed the device-summary row's width and baseline mismatch. Reopened this area against the source crop and the user's screenshot.

- Root cause: the mini-companion group was 330px wide versus about 460px in the reference, shifting the separator and device text left; atlas frames have unequal transparent foot padding. Section and caption padding also accumulated below the row.
- Corrected only the row's CSS: 460px four-column group, constrained grid row, per-frame foot offsets, 36px gap, separator at x616.5 and copy at x662.5 for the reference desktop width, 20px text, 48px ticket, and reduced bottom spacing.
- The medium-width layout switches before the reference row becomes crowded; mobile remains stacked and centered.
- Source and final implementation shown together: qa/plans-notes-comparison-v2.jpg (via qa/plans-notes-compare.html). Final focused screenshot: qa/plans-notes-alignment-v2.jpg; mobile: qa/plans-notes-mobile-v2.jpg.
- At 320, 390, 768, 1024, 1210, 1280 and 1440 CSS pixels: no horizontal page or copy overflow; browser warning/error logs empty.
- Typography, group spacing, olive/ivory palette, original pixel asset sharpness and unchanged product copy checked. Original sprite identities and native icon assets remain intentional; generated sparkle accents remain optional P3 polish.
- Syntax and production build verified after this correction.

Focused review final result: passed
