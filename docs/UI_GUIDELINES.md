# UI / UX Guidelines

## Experience
Premium but practical. The app is used frequently, so speed and clarity outrank decorative effects.

## Mobile navigation
Recommended tabs:
- Home
- Transactions
- Add (central FAB/action)
- Reports
- More

Budget/calendar can live in Home/More or be promoted based on usage.

## Desktop
Left sidebar plus content area.
Dashboard uses responsive KPI/chart grid.

## Dashboard
Top:
- household switcher (if needed)
- month selector
- member filter

Then KPI cards.
Then primary trend chart.
Then category/payment/member charts.
Then budget status.
Then top/recent expenses.

## Add expense
Use a full-screen mobile sheet/page.
Amount input first and large.
Keep optional fields collapsed under “More details”.
Remember last-used safe preferences only when clearly communicated.

## Transaction list
Mobile: transaction cards grouped by date.
Desktop: TanStack Table.
Both must offer filter/search and clear payer/category/member context.

## Calendar
Month grid with daily totals.
Tap/click day for detail.

## Responsive breakpoints
Follow Tailwind conventions, but design from narrow viewport upward.
Test approximately 360px, 390px, tablet, laptop, wide desktop.

## Accessibility
- semantic HTML
- keyboard focus
- visible focus indicators
- labels for controls
- sufficient contrast
- charts must have textual summaries/legends
- don't rely on red/green alone

## Empty states
Every major screen needs a useful empty state and direct action.

## Loading
Use skeletons for dashboards/lists; avoid layout jumps.

## Destructive actions
Confirmation for destructive actions. Prefer archive where appropriate.
