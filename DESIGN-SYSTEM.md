# JQ Bookcases Design System

This file records the public brand vocabulary and shared interface scales used by the website and 3D configuration application. The source of truth for implementation tokens is `styles.css`.

## Official naming

- Brand: **JQ Bookcases**
- Brand lockup descriptor: **Built-Ins & Millwork**
- Product: **3D Bookcase Configurator**
- Primary design action: **Design Your Bookcase**
- Quote action and page: **Request a Quote**
- Submitted form: **quote request**
- Follow-up stage: **project review**

Use “the configurator” only after the full product name has appeared. `JQ` remains valid only for the favicon monogram and generated design identifiers.

## Typography

The shared scale is responsive and capped:

| Role | Desktop | Mobile |
| --- | --- | --- |
| Display / hero | 42–56px | 32–40px |
| Page title | 36–48px | 28–36px |
| Section heading | 28–36px | 24–30px |
| Subheading | 20–26px | 20–24px |
| Card title | 18–22px | 18px |
| Body | 16px | 16px |
| Lead body | 16–18px | 16–18px |
| Button | 15px | 15px |
| Label | 14px | 14px |
| Caption | 13px | 13px |
| Small helper text | 12px | 12px |

Headings use the shared serif stack. Body copy and interface controls use the shared sans-serif stack. Reading text is limited to approximately `68ch`. Do not introduce page-specific heading scales.

## Spacing and controls

The core spacing scale is:

`4px · 8px · 12px · 16px · 24px · 32px · 48px · 64px · 96px`

Semantic aliases cover page gutters, section spacing, card padding, field gaps, control height, and touch targets. Normal controls are at least 46px high; interactive targets are at least 44px. Smaller literal values are reserved for borders, icon geometry, optical alignment, and tightly coupled 3D configurator illustrations.

## Layout exceptions

The 3D Bookcase Configurator intentionally uses a denser full-screen desktop shell and hides the shared footer while the application is active. It still inherits the same brand lockup, type roles, focus treatment, control sizing, and mobile reading requirements as the marketing pages.

## QA contract

- Exactly one H1 per page.
- No horizontal page scrolling at 320 CSS pixels.
- No lost content or functionality at a 200% zoom-equivalent viewport.
- Body copy remains at least 16px on mobile.
- Visible helper text remains at least 12px.
- Keyboard focus must be visible on custom controls.
- Canonical brand, product, and CTA vocabulary is protected by automated tests.
