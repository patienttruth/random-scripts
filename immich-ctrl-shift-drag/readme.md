
# Immich Ctrl+Shift File Drag

A free and open-source browser userscript that lets you drag original photo files directly from [Immich](https://immich.app/) into another website's file-upload area, including a separate browser window.

Works from both the photo viewer and the photo-library thumbnail grid, without opening the image in a separate tab.

**License:** GPL-3.0-or-later

**Project status:** Working in Brave/Chromium. Community-developed and not affiliated with or endorsed by Immich.

## Features

- Drag original-resolution images directly into other websites
- Support for library thumbnails and the full-screen photo viewer
- Ctrl+Shift activation to avoid interfering with normal Immich interactions
- Select the image beneath the pointer when the keyboard shortcut is pressed
- Temporary green drag overlay
- Status toast showing image processing, readiness, and drag status
- Automatic cleanup of the overlay and toast after dragging
- In-memory caching of downloaded originals
- Original filenames preserved when provided by Immich
- Experimental automatic deselection after dragging
- No Immich server modifications required
- No API keys or external services required

## Usage

1. Position the cursor over an image in Immich.
2. Press and hold **Ctrl+Shift**.
3. The script identifies the image beneath the pointer.
4. A toast displays `Processing image...` while retrieving the original.
5. Once ready, a translucent green overlay appears over the image.
6. Drag from the green overlay into another website's upload area.
7. Release the mouse to complete the drag.

The overlay and toast disappear when the drag ends or the modifier keys are released.

The image is selected at the moment Ctrl+Shift is activated. Moving over other thumbnails while holding the keys does not change the selected image.

Previously downloaded images are cached in browser memory, allowing faster subsequent drags.

## Installation

### Requirements

- [Immich](https://immich.app/)
- A Chromium-based browser with compatible file drag-and-drop support
- A userscript manager:
  - [Violentmonkey](https://violentmonkey.github.io/get-it/) (recommended, open source)
  - [Tampermonkey](https://www.tampermonkey.net/)

### Install the userscript

1. Install a userscript manager.
2. Create a new userscript.
3. Copy the contents of `immich-ctrl-shift-drag.user.js`.
4. Configure the `@match` directive for your Immich hostname.

Example:

```javascript
// @match        https://immich.example.com/*
```

Replace `immich.example.com` with your actual Immich hostname.

5. Save and enable the script.
6. Reload Immich.
7. Test Ctrl+Shift+Drag on an image.

The userscript executes only on matching URLs.

### Browser configuration

The initial working environment was:

- Brave 1.99.55
- Chromium 157.0.8103.39
- 64-bit Windows

Chromium's support for transferring JavaScript-created `File` objects between browser windows may depend on its version and enabled features.

An experimental Chromium feature relevant to this capability is:

```text
DragAndDropJSFileObjects
```

It may be enabled using the browser startup argument:

```text
--enable-blink-features=DragAndDropJSFileObjects
```

You can also search `brave://flags` or `chrome://flags` for the feature. It is not necessarily exposed in the browser's graphical flags interface.

To confirm an active startup argument, inspect the command line under `brave://version` or `chrome://version`.

This feature is experimental, may change or disappear, and has not been established as necessary for every browser installation.

## How it works

### 1. Asset identification

The script listens for Ctrl+Shift and identifies the photo under the cursor.

For library thumbnails, it prioritizes Immich's `data-asset-id` attribute.

For the photo viewer, it uses available image attributes and asset identifiers.

The asset is selected once per keyboard activation.

### 2. Original file retrieval

The script retrieves the original file using Immich's authenticated endpoint:

```text
/api/assets/{assetId}/original
```

Requests use the browser's existing Immich session.

No separate API key is required.

### 3. File preparation

The retrieved data is converted into a JavaScript `File` object.

The script preserves the original filename when available from the server's `Content-Disposition` header.

Otherwise, a fallback filename is generated.

The file is cached in memory to avoid unnecessary repeat downloads.

### 4. Native drag-and-drop

Once the file is available, a temporary draggable overlay appears over the image.

During the native `dragstart` event, the script attaches the file using:

```javascript
event.dataTransfer.items.add(file);
event.dataTransfer.effectAllowed = "copy";
```

This allows compatible destination websites to receive an actual file rather than an image URL.

The transfer must be prepared before dragging begins. JavaScript cannot asynchronously add the file after the native `dragstart` event has completed.

### 5. Cleanup

When dragging finishes, the script:

- Removes the temporary overlay
- Hides the status toast
- Resets the active image selection within the script
- Attempts to clear Immich's thumbnail selection using an Escape keyboard event

The Escape-based deselection is experimental and may not work on every Immich version.

## Troubleshooting

| Problem | Possible solution |
| --- | --- |
| Nothing happens when pressing Ctrl+Shift | Verify the `@match` hostname and that the script is enabled. |
| No image under cursor | Position the cursor directly over a thumbnail before pressing the shortcut. |
| Image download fails | Verify that your Immich session is authenticated and that the original is accessible. |
| Green overlay appears, but dragging fails | Start the drag directly from the green overlay. |
| Drag starts, but the destination rejects the image | Check browser compatibility and whether the destination accepts file drops. |
| Wrong image is selected | Check whether Immich's thumbnail DOM structure has changed. |
| Image remains selected after dragging | Automatic deselection may not be supported by Immich's keyboard-event handler. |
| Toast remains visible | Release the modifier keys or reload the page. |

Developer Tools console messages are prefixed with:

```text
[Immich Drag]
```

## Known limitations

- Browser compatibility has not been comprehensively tested.
- Some destination websites may reject JavaScript-generated file drops.
- The script currently transfers one asset per drag.
- Original files are cached in browser memory until the page is reloaded.
- Large files may consume significant memory.
- Changes to Immich's frontend or API may require script updates.
- The automatic Escape-based deselection is best-effort and may clear existing multi-selections if honored by Immich.
- Upload success is controlled by the destination website, not this script.

## Security and privacy

The script operates within the authenticated Immich browser session.

It does not require an Immich API key, external dependencies, or third-party services.

Original image data is retrieved from Immich and held in browser memory until the page is reloaded.

The destination website receives the file when the user explicitly drags it there.

Users should:

- Restrict `@match` to their own Immich hostname.
- Review the userscript before installation.
- Avoid installing modified versions from untrusted sources.
- Be aware that the script has access to media authorized by their active Immich session.

## Repository structure

```text
immich-ctrl-shift-drag/
├── README.md
├── LICENSE
└── immich-ctrl-shift-drag.user.js
```

## Development history

The project began as a workaround for the inability to drag photos directly from Immich into upload areas in other browser windows.

Development progressed through several approaches:

1. Directly modifying image drag behavior.
2. Identifying and retrieving original Immich assets.
3. Introducing a temporary draggable overlay.
4. Testing Chromium's `DownloadURL` transfer format.
5. Switching to native drag events carrying JavaScript `File` objects.
6. Adding visual status feedback and automatic cleanup.
7. Extending support to library thumbnails.
8. Capturing the asset beneath the pointer at Ctrl+Shift activation.
9. Adding experimental selection cleanup after dragging.

The resulting userscript makes it possible to transfer original Immich images directly into compatible web applications without separately opening or downloading each photo.

## Contributing

Contributions, bug reports, testing, and improvements are welcome.

Useful contributions include:

- Compatibility testing across browsers
- Support for additional Immich versions
- Improvements to asset identification
- More reliable selection cleanup
- Better error reporting
- Reduced memory consumption
- Multiple-file drag-and-drop support

Contributions should preserve the project's free-software licensing.

By submitting a contribution, you agree to license that contribution under GPL-3.0-or-later.

## License

Copyright (c) 2026 Project contributors.

This project is free software licensed under the **GNU General Public License, version 3 or (at your option) any later version**.

You are free to:

- Use the software for any purpose
- Study how it works
- Modify it to suit your needs
- Share copies with others
- Distribute modified versions

When distributing the software or modified versions, you must comply with the GPL's terms, including providing the corresponding source code where required and preserving applicable license notices.

The license allows commercial use. However, distributors cannot turn GPL-covered versions into proprietary software in violation of the license's conditions.

The project's purpose is to preserve users' freedom to use, study, modify, and share the software, rather than restrict its use for commercial gain.

The software is provided without warranty.

See [LICENSE](LICENSE) for the complete license terms.

Official license information:

https://www.gnu.org/licenses/gpl-3.0.html

SPDX identifier:

```text
GPL-3.0-or-later
```

## Disclaimer

This is an independent community project.

It is not affiliated with, maintained by, or endorsed by the Immich project.

Immich and its associated trademarks belong to their respective owners.
