
// ==UserScript==
// @name         Immich Ctrl+Shift File Drag
// @namespace    local.immich
// @version      0.6
// @description  Drag original Immich images from thumbnails or viewer into other websites
// @match        https://YOUR-IMMICH-HOST/*
// @grant        none
// @run-at       document-idle
// @license      GPL-3.0-or-later
// ==/UserScript==

// SPDX-License-Identifier: GPL-3.0-or-later
//
// Immich Ctrl+Shift File Drag
// Copyright (C) 2026 Project contributors
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation, either version 3
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty
// of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// See the GNU General Public License for more details.
//
// https://www.gnu.org/licenses/gpl-3.0.html

(() => {
  "use strict";

  const UUID =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const cache = new Map();

  let activeElement = null;
  let activeId = null;
  let dragging = false;
  let modifiersHeld = false;
  let selectedForChord = false;

  let pointerX = null;
  let pointerY = null;

  // ---------- Toast ----------

  const toast = document.createElement("div");

  Object.assign(toast.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    display: "none",
    background: "#222",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
    font: "13px system-ui, sans-serif",
    pointerEvents: "none",
    maxWidth: "320px",
    overflowWrap: "anywhere"
  });

  document.body.append(toast);

  function status(message, color = "white") {
    console.log("[Immich Drag]", message);

    if (!modifiersHeld && !dragging) return;

    toast.textContent = message;
    toast.style.color = color;
    toast.style.display = "block";
  }

  // ---------- Overlay ----------

  const overlay = document.createElement("div");

  overlay.draggable = true;
  overlay.title = "Drag original Immich image";

  Object.assign(overlay.style, {
    position: "fixed",
    zIndex: "2147483646",
    display: "none",
    background: "rgba(0,180,100,0.12)",
    outline: "2px solid #00c878",
    cursor: "grab",
    userSelect: "none"
  });

  document.body.append(overlay);

  function resetUI() {
    overlay.style.display = "none";
    toast.style.display = "none";

    activeElement = null;
    activeId = null;
    selectedForChord = false;
  }

  function endChord() {
    modifiersHeld = false;

    if (!dragging) {
      resetUI();
    }
  }

  function positionOverlay() {
    if (!activeElement || !activeElement.isConnected) {
      overlay.style.display = "none";
      return false;
    }

    const rect = activeElement.getBoundingClientRect();

    if (rect.width < 5 || rect.height < 5) {
      overlay.style.display = "none";
      return false;
    }

    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);

    if (right <= left || bottom <= top) {
      overlay.style.display = "none";
      return false;
    }

    Object.assign(overlay.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`
    });

    return true;
  }

  function showOverlay() {
    if (
      !modifiersHeld ||
      dragging ||
      !activeElement ||
      !activeId
    ) return;

    const entry = cache.get(activeId);

    if (!entry?.file) return;

    if (!positionOverlay()) return;

    overlay.style.display = "block";

    const mb =
      (entry.file.size / 1048576).toFixed(1);

    status(
      `Ready to drag: ${entry.file.name} (${mb} MB)`,
      "#86efac"
    );
  }

  // ---------- Asset detection ----------

  function extractUUID(value) {
    if (!value) return null;
    return value.match(UUID)?.[0] || null;
  }

  function findAsset(target) {
    if (!(target instanceof Element)) return null;

    // Prefer the asset ID on the library thumbnail
    // over any identifier in the page URL.
    const tile = target.closest("[data-asset-id]");

    if (tile) {
      const id = extractUUID(
        tile.getAttribute("data-asset-id")
      );

      if (id) {
        return {
          id,
          element: tile
        };
      }
    }

    // Fallback for viewer images and other layouts.
    const img =
      target.matches("img")
        ? target
        : target.closest("img") ||
          target.querySelector("img");

    if (!img) return null;

    const candidates = [
      img.currentSrc,
      img.src
    ];

    let node = img;

    for (let i = 0; node && i < 8; i++) {
      candidates.push(
        node.getAttribute("data-asset-id"),
        node.getAttribute("href")
      );

      node = node.parentElement;
    }

    // Check image and ancestor identifiers.
    for (const value of candidates) {
      const id = extractUUID(value);

      if (id) {
        return {
          id,
          element: img
        };
      }
    }

    // Viewer fallback only.
    // Never use the page URL to identify
    // a thumbnail in the library grid.
    const viewerId = extractUUID(
      location.pathname.match(
        /\/photos\/([^/?]+)/i
      )?.[1]
    );

    if (viewerId) {
      return {
        id: viewerId,
        element: img
      };
    }

    return null;
  }

  // ---------- Filename ----------

  function getFilename(response, id, type) {
    const disposition =
      response.headers.get("content-disposition");

    const encoded = disposition?.match(
      /filename\*=UTF-8''([^;]+)/i
    );

    if (encoded) {
      try {
        return decodeURIComponent(encoded[1]);
      } catch {}
    }

    const regular = disposition?.match(
      /filename="?([^";]+)"?/i
    );

    if (regular) return regular[1];

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
      "image/avif": "avif",
      "image/gif": "gif",
      "image/tiff": "tif"
    };

    return `${id}.${extensions[type] || "bin"}`;
  }

  // ---------- Load original ----------

  async function preload(id) {
    if (cache.has(id)) return cache.get(id);

    const entry = {
      file: null,
      loading: true
    };

    cache.set(id, entry);

    if (activeId === id) {
      status("Processing image...", "#fde68a");
    }

    try {
      const response = await fetch(
        `/api/assets/${id}/original`,
        { credentials: "same-origin" }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();

      const type =
        blob.type || "application/octet-stream";

      const filename =
        getFilename(response, id, type);

      entry.file = new File(
        [blob],
        filename,
        {
          type,
          lastModified: Date.now()
        }
      );

      entry.loading = false;

      if (
        activeId === id &&
        modifiersHeld &&
        !dragging
      ) {
        showOverlay();
      }

    } catch (error) {
      cache.delete(id);

      if (activeId === id && modifiersHeld) {
        status(
          `Image failed: ${error.message}`,
          "#fca5a5"
        );
      }
    }

    return entry;
  }

  // ---------- Select image under cursor ----------

  function selectUnderPointer() {
    if (!modifiersHeld || dragging) return;
    if (selectedForChord) return;

    if (pointerX === null || pointerY === null) {
      status("Move pointer over an image", "#fde68a");
      return;
    }

    // Ignore the overlay when checking
    // the element beneath the pointer.
    const oldPointerEvents = overlay.style.pointerEvents;
    overlay.style.pointerEvents = "none";

    const target = document.elementFromPoint(
      pointerX,
      pointerY
    );

    overlay.style.pointerEvents = oldPointerEvents;

    const asset = findAsset(target);

    if (!asset) {
      status("No image under cursor", "#fde68a");
      return;
    }

    activeElement = asset.element;
    activeId = asset.id;
    selectedForChord = true;

    const entry = cache.get(activeId);

    if (entry?.file) {
      showOverlay();
    } else if (entry?.loading) {
      status("Processing image...", "#fde68a");
    } else {
      preload(activeId);
    }
  }

  // ---------- Pointer tracking ----------

  document.addEventListener("pointermove", event => {
    if (dragging) return;

    pointerX = event.clientX;
    pointerY = event.clientY;

    // Fallback if a modifier transition
    // wasn't observed by keydown.
    const held = event.ctrlKey && event.shiftKey;

    if (!held) {
      if (modifiersHeld) endChord();
      return;
    }

    if (!modifiersHeld) {
      modifiersHeld = true;
      status("Preparing image...", "#fde68a");
    }

    selectUnderPointer();

  }, true);

  // ---------- Keyboard handling ----------

  document.addEventListener("keydown", event => {
    const held = event.ctrlKey && event.shiftKey;

    if (held && !modifiersHeld) {
      modifiersHeld = true;

      status("Preparing image...", "#fde68a");

      // Capture the asset at the pointer
      // position when the second modifier
      // key is pressed.
      selectUnderPointer();
    }

    if (!held && modifiersHeld && !dragging) {
      endChord();
    }
  }, true);

  document.addEventListener("keyup", event => {
    const held = event.ctrlKey && event.shiftKey;

    if (!held && modifiersHeld) {
      endChord();
    }
  }, true);

  // ---------- Native file drag ----------

  overlay.addEventListener("dragstart", event => {
    const entry = cache.get(activeId);

    if (!entry?.file) {
      event.preventDefault();
      status("File not ready", "#fca5a5");
      return;
    }

    try {
      const dt = event.dataTransfer;

      dt.clearData();

      // Attach the original image as a
      // JavaScript File object.
      dt.items.add(entry.file);

      dt.effectAllowed = "copy";

      dragging = true;

      status(
        `Dragging: ${entry.file.name}`,
        "#86efac"
      );

      console.log("[Immich Drag] Payload:", {
        types: Array.from(dt.types),
        files: Array.from(dt.files).map(f => ({
          name: f.name,
          type: f.type,
          size: f.size
        }))
      });

      // Prevent Immich from modifying
      // our drag payload.
      event.stopImmediatePropagation();

    } catch (error) {
      event.preventDefault();

      status(
        `Drag failed: ${error.message}`,
        "#fca5a5"
      );
    }
  }, true);

  // ---------- Drag completion ----------

  overlay.addEventListener("dragend", () => {
    dragging = false;
    modifiersHeld = false;

    resetUI();

    // Experimental selection cleanup.
    //
    // Allow Immich to finish handling the drag
    // before attempting to clear selections.
    //
    // This may clear all selected images if
    // Immich accepts the synthetic Escape event.

    setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true
        })
      );
    }, 100);
  });

  // ---------- Cleanup ----------

  window.addEventListener("blur", () => {
    if (!dragging) {
      endChord();
    }
  });

  window.addEventListener("focus", () => {
    if (!dragging) {
      endChord();
    }
  });

  window.addEventListener("scroll", () => {
    if (
      overlay.style.display !== "none" &&
      !dragging
    ) {
      positionOverlay();
    }
  }, true);

  console.log(
    "[Immich Drag] v0.6 loaded. " +
    "Hold Ctrl+Shift over a thumbnail or viewer image."
  );

})();
