# Design System

## Principles
- Clean
- Calm
- Financially trustworthy
- High information clarity
- Minimal visual noise
- Consistent spacing

## Components
Use shadcn/ui as a foundation, customized through design tokens.

Core components:
- Button
- Input
- Currency input
- Select/combobox
- Date picker
- Member picker
- Category picker
- Split editor
- Dialog/sheet
- Tabs
- Card
- KPI card
- Chart card
- Data table
- Transaction row/card
- Badge
- Progress/budget bar
- Toast
- Skeleton
- Empty state

## Theme
Support light, dark, and system preference.

## Status semantics
Budget:
- safe
- warning
- exceeded

Always pair color with icon/text/percentage.

## Typography
Use a clean modern sans-serif suitable for numbers.
Use tabular numerals for monetary KPIs where available.

## Motion
Subtle, purposeful:
- card transitions
- sheet/dialog transitions
- chart changes
Avoid excessive animation.

## Currency
Primary default can be INR, but currency must be configurable.
Display using `Intl.NumberFormat`.
Storage uses integer minor units.
