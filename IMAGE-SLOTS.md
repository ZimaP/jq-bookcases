# Image Slots

The site currently uses premium temporary asset slots instead of fake render imagery. Most visual slots carry a small `JQ-*` staging tag through the `data-slot` attribute. The homepage hero currently uses the live CSS bookcase preview instead of a labeled slot so the first viewport feels more product-led while approved imagery is pending.

Any existing JPEGs under `assets/photos/` should be treated as non-production until they are replaced with approved real photography or approved professional renders from the list below.

To replace a slot, add the real image under `assets/photos/`, add `has-image` to the slot element, and set `--slot-image`, for example:

```html
<div class="room-art room-living has-image" data-slot="JQ-ROOM-01 / Living room built-in" style="--slot-image: url('assets/photos/inspiration-living.jpg')"></div>
```

Use real project photography or genuinely high-end professional renders only. Avoid screenshot crops, obvious AI artifacts, stock-like dark mood images, watermarks, low-resolution files, and mismatched color grading.

## Required Real Assets

| Slot ID | Target file | Needed image |
|---|---|---|
| JQ-HERO-01 | `assets/photos/hero-product.jpg` | Optional future homepage hero asset: finished built-in bookcase, straight-on or slight angle, light background, open shelves plus lower cabinets, minimum 2400px wide. |
| JQ-MAT-01 | `assets/photos/material-plywood.jpg` | Close-up of premium plywood edge layers or panels, clean shop lighting, minimum 1600px wide. |
| JQ-MAT-02 | `assets/photos/material-paint.jpg` | Paint-grade finish close-up showing a crisp cabinet edge or panel, minimum 1600px wide. |
| JQ-MAT-03 | `assets/photos/material-veneer.jpg` | Wood veneer grain detail with warm natural tone, minimum 1600px wide. |
| JQ-MAT-04 | `assets/photos/material-hardware.jpg` | Premium pull/knob or hinge detail installed on a cabinet door, minimum 1600px wide. |
| JQ-MAT-05 | `assets/photos/material-doors.jpg` | Cabinet door stile/rail or inset-panel detail, minimum 1600px wide. |
| JQ-MAT-06 | `assets/photos/material-shelves.jpg` | Adjustable shelf/pin or interior shelf detail, minimum 1600px wide. |
| JQ-MAT-07 | `assets/photos/material-finishing.jpg` | Real finishing process: spraying, sanding, or careful topcoat application, minimum 1600px wide. |
| JQ-MAT-08 | `assets/photos/material-installed-finish.jpg` | Installed finish close-up showing final surface quality in a home, minimum 1600px wide. |
| JQ-SHOP-01 | `assets/photos/shop-hero.jpg` | Wide workshop hero with real millworker or bench setup, warm premium lighting, minimum 2400px wide. |
| JQ-SHOP-02 | `assets/photos/shop-cabinetmakers.jpg` | Cabinetmaker working at a bench, hands/detail visible, minimum 1800px wide. |
| JQ-SHOP-03 | `assets/photos/shop-tables.jpg` | Fabrication tables or in-progress casework in the shop, minimum 1800px wide. |
| JQ-SHOP-04 | `assets/photos/shop-cnc.jpg` | CNC/router work or precision cutting detail, minimum 1800px wide. |
| JQ-SHOP-05 | `assets/photos/shop-finishing.jpg` | Finishing booth or hand-finishing moment, minimum 1800px wide. |
| JQ-SHOP-06 | `assets/photos/shop-assembly.jpg` | Bookcase/cabinet assembly in shop, minimum 1800px wide. |
| JQ-SHOP-07 | `assets/photos/shop-install.jpg` | Professional installation in a finished home, minimum 1800px wide. |
| JQ-ROOM-01 | `assets/photos/inspiration-living.jpg` | Living room built-in with fireplace or seating context, minimum 2200px wide. |
| JQ-ROOM-02 | `assets/photos/inspiration-office.jpg` | Home office wall with built-in shelves and desk/work context, minimum 2200px wide. |
| JQ-ROOM-03 | `assets/photos/inspiration-library.jpg` | Library wall in darker wood or classic finish, minimum 2200px wide. |
| JQ-ROOM-04 | `assets/photos/inspiration-lower-cabinets.jpg` | Built-in bookcase with lower cabinet storage, minimum 2200px wide. |
| JQ-ROOM-05 | `assets/photos/inspiration-media.jpg` | Media wall with TV and integrated shelving, minimum 2200px wide. |
| JQ-ROOM-06 | `assets/photos/inspiration-white-classic.jpg` | White painted classic built-in, ideally with trim/crown detail, minimum 2200px wide. |
| JQ-ROOM-07 | `assets/photos/inspiration-walnut.jpg` | Walnut or warm modern built-in, minimum 2200px wide. |
| JQ-ROOM-08 | `assets/photos/inspiration-alcove-storage.jpg` | Alcove or niche built-in storage vignette, minimum 2200px wide. |
| JQ-ROOM-09 | `assets/photos/inspiration-desk-bookcase.jpg` | Desk plus bookcase wall, minimum 2200px wide. |
| JQ-ROOM-10 | `assets/photos/room-hero.jpg` | Warm installed built-in hero for the About page bottom CTA, minimum 2400px wide. |
| JQ-FAQ-01 | `assets/photos/faq-hero.jpg` | Calm room hero with built-ins for FAQ page, minimum 2400px wide. |
