# Cabinet AR Manual QA Checklist

Automated tests validate normalization, units, hashing, share-link round trips,
request staleness, capability fallbacks, analytics allowlisting, and GLB
structure. They do not verify a physical camera or AR surface session.

Use a production-like HTTPS URL and the same model provider/CDN configuration
intended for release. For each device, configure more than one cabinet and note
the configuration hash, browser/OS version, load time, and any launch failure.

## Configuration and scale

- [ ] Configure a known width, height, and depth; confirm the dialog summary.
- [ ] Measure the placed cabinet width, height, and depth against known room
      references. Test at least 48×84×12 in and 120×108×20 in configurations.
- [ ] Confirm the model stays at 100% scale and cannot be arbitrarily pinched
      larger or smaller.
- [ ] Confirm floor contact at the cabinet base, not its center or top.
- [ ] Confirm the front faces the customer at initial placement.
- [ ] Confirm section count, shelf count/positions, lower doors/drawers, base,
      crown, finish, and hardware approximation match the configurator.
- [ ] Change width or an option while model preparation is slow; verify the old
      result never replaces the newer configuration.

## iPhone Safari

- [ ] Test current Safari on an AR-capable iPhone over HTTPS.
- [ ] Confirm camera access is requested only after `Start AR`.
- [ ] Deny camera permission and verify a useful recovery message.
- [ ] Allow camera access, scan the floor, place, move, rotate, and walk around.
- [ ] Exit Quick Look and confirm the exact configurator state is retained.
- [ ] Repeat with a production provider USDZ if configured; verify finish,
      orientation, bounds, and floor origin.

## iPad Safari

- [ ] Repeat the iPhone flow on a current AR-capable iPad.
- [ ] Check portrait and landscape dialog layout and Quick Look return behavior.

## iPhone/iPad Chrome, Edge, and Firefox

- [ ] Test a current third-party iOS browser over HTTPS.
- [ ] Confirm the client-side USDZ fallback exposes `Start AR`.
- [ ] Confirm tapping `Start AR` launches Apple Quick Look and preserves fixed scale.

## Android Chrome

- [ ] Test current Chrome on an ARCore/WebXR-capable Android phone over HTTPS.
- [ ] Allow camera access, scan the floor, place, move, rotate, and walk around.
- [ ] Verify the scan-floor prompt and fixed scale.
- [ ] Deny permission and confirm the session failure is human-readable.
- [ ] With the remote provider configured, force/test Scene Viewer fallback and
      confirm the public GLB downloads with the correct content type and scale.
- [ ] Exit AR and confirm the exact configurator state is retained.

## Fallbacks and handoff

- [ ] On a non-AR mobile device, confirm interactive 3D remains available and
      the compatibility explanation names iPhone/iPad or Android requirements.
- [ ] In an Instagram/Facebook or other restricted in-app browser, confirm the
      customer is directed to Safari or Chrome.
- [ ] On desktop Chrome, Safari, and Firefox, rotate/zoom the model and scan the
      QR with a phone.
- [ ] Confirm the QR and normal link open the exact width, height, depth,
      sections, shelves, storage, construction, finish, hardware, and lighting.
- [ ] Confirm no customer or room data appears in the QR URL.
- [ ] Block the QR CDN and confirm the normal phone link remains available.

## Reliability, accessibility, and privacy

- [ ] Throttle to Slow 3G; verify loading text changes after six seconds and the
      button cannot launch duplicate preparation requests.
- [ ] Block the model-viewer CDN; verify a polished error and unchanged design.
- [ ] Return missing/invalid GLB, USDZ, poster, content type, hash, processing,
      and unsupported responses from a test provider; verify safe messages.
- [ ] Navigate the launch button, dialog, close button, model, instructions, and
      phone link with a keyboard and visible focus.
- [ ] Check loading/error/compatibility states with VoiceOver and TalkBack.
- [ ] Enable reduced motion and confirm the spinner does not animate.
- [ ] Inspect network traffic: no camera frame, room image, or customer data may
      be uploaded.
- [ ] Disable `data-enable-cabinet-ar`; confirm no AR button, model-viewer script,
      QR module, or model request occurs.
