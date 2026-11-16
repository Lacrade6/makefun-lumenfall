// Keyboard and mouse state, read by the world step. The canvas listens for
// keys and pointer movement; the game reads this snapshot each tick instead
// of handling events inline, so the autopilot can drive the same fields.

export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    firing: false,
    dashQueued: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered actions, consumed once by the state machine.
    pressedKeys: new Set(),
  };
}

const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    const field = KEY_MAP[event.code];
    if (field) {
      input[field] = true;
      event.preventDefault();
    }
    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      input.dashQueued = true;
      event.preventDefault();
    }
    input.pressedKeys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    const field = KEY_MAP[event.code];
    if (field) input[field] = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    input.mouseDown = true;
    input.firing = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    input.mouseDown = false;
    input.firing = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.firing = false;
    input.mouseDown = false;
  });
}

/** Consume one press of a key, if it happened since the last check. */
export function consumeKey(input, code) {
  if (input.pressedKeys.has(code)) {
    input.pressedKeys.delete(code);
    return true;
  }
  return false;
}

/** Clear edge-triggered state at the end of a tick. */
export function endTick(input) {
  input.dashQueued = false;
}
