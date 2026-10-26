'use strict';
(() => {
  // Retry blocked audible playback inside a trusted user gesture. Detach first
  // so another input can never undo a later explicit pause.
  function createAutoplayGate({target, play, canStart, ignore = () => false}) {
    const gestures = ['pointerup', 'touchend', 'click', 'keydown'];
    let pending = false, listening = false, suspended = false, disposed = false;
    function detach() {
      if (!listening) return;
      for (const type of gestures) target.removeEventListener(type, onGesture);
      target.removeEventListener('visibilitychange', onVisible);
      listening = false;
    }
    function attach() {
      if (listening || suspended || disposed) return;
      for (const type of gestures) target.addEventListener(type, onGesture, {passive: true});
      target.addEventListener('visibilitychange', onVisible);
      listening = true;
    }
    function attempt() {
      if (!pending || suspended || disposed || !canStart()) return false;
      pending = false; detach(); play();
      return true;
    }
    function onGesture(event) {
      if (!event.isTrusted || event.defaultPrevented || ignore(event)) return;
      if (event.type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Escape' || event.key === 'Tab')) return;
      attempt();
    }
    function onVisible() { attempt(); }
    return {
      get pending() { return pending; },
      start() { if (disposed) return; pending = true; attach(); attempt(); },
      blocked() { if (disposed) return; pending = true; attach(); },
      cancel() { pending = false; detach(); },
      suspend() { suspended = true; detach(); },
      resume() { suspended = false; if (pending) { attach(); attempt(); } },
      dispose() { disposed = true; pending = false; detach(); }
    };
  }
  globalThis.ArchiveAudio = Object.freeze({createAutoplayGate});
})();
