(() => {
  'use strict';
  const R = globalThis.River;
  const targets = '.weak-sign,.hand-card,.combat-spell,.traveler-position,.folio-row,.folio-spell,.folio-strap,.folio-unhang,[data-drop-zone]';

  // Keep the rules independent of pointer events so mouse and touch use exactly
  // the same game actions (and the same validation as clicking).
  function planDrop(g, source, target) {
    if (!g || !source || !target) return null;
    const { kind, id } = source;
    if (kind === 'hand' && g.scene === 'battle' && g.battle?.hand.includes(id)) {
      if (target.kind === 'tag') return { action: 'attack', card: id, enemy: target.enemy, tag: target.id };
      if (target.kind === 'combat-spell' && R.skills[target.id]?.target === 'card' && R.canCast(g, target.id, id))
        return { action: 'cast', skill: target.id, target: id };
    }
    if (kind === 'combat-spell' && g.scene === 'battle' && R.canCast(g, id)) {
      const skill = R.skills[id];
      if (skill.target === 'self' && target.kind === 'hero') return { action: 'cast', skill: id };
      if (skill.target === 'card' && target.kind === 'hand' && R.canCast(g, id, target.id))
        return { action: 'cast', skill: id, target: target.id };
      if (skill.target === 'tag' && target.kind === 'tag') {
        const choice = { enemyId: target.enemy, tagId: target.id };
        if (R.canCast(g, id, choice)) return { action: 'cast', skill: id, target: choice };
      }
    }
    if (!R.canGear(g)) return null;
    if (kind === 'reserve' && g.collection[id] && !g.deck.includes(id)) {
      if (target.kind === 'equipped' || target.kind === 'equipped-zone')
        return { action: 'deck', add: id, remove: target.kind === 'equipped' ? target.id : null };
    }
    if (kind === 'equipped' && g.deck.includes(id)) {
      if (target.kind === 'reserve' && g.collection[target.id] && !g.deck.includes(target.id))
        return { action: 'deck', add: target.id, remove: id };
      if (target.kind === 'reserve-zone') return { action: 'deck', remove: id };
      if (target.kind === 'equipped' && id !== target.id)
        return { action: 'deck-order', from: id, to: target.id };
    }
    if (kind === 'learned-spell' && g.learned.includes(id) && target.kind === 'spell-slot') {
      if (g.slots[target.index] !== id) return { action: 'slot', index: target.index, skill: id };
    }
    if (kind === 'slot-spell' && g.slots[source.index] === id) {
      if (target.kind === 'spell-slot' && target.index !== source.index)
        return { action: 'slot', index: target.index, skill: id };
      if (target.kind === 'learned-zone')
        return { action: 'slot', index: source.index, skill: null };
    }
    return null;
  }

  function describe(element) {
    if (element.matches('.weak-sign')) return { kind: 'tag', id: element.dataset.val, enemy: element.dataset.enemy };
    if (element.matches('.hand-card')) return { kind: 'hand', id: element.dataset.val };
    if (element.matches('.combat-spell')) return { kind: 'combat-spell', id: element.dataset.val };
    if (element.matches('.traveler-position')) return { kind: 'hero' };
    if (element.matches('.folio-row')) return { kind: element.dataset.act, id: element.dataset.val };
    if (element.matches('.folio-strap')) return { kind: 'spell-slot', index: Number(element.dataset.val) };
    if (element.matches('.folio-spell,.folio-unhang')) return { kind: 'learned-zone' };
    if (element.matches('[data-drop-zone]')) return { kind: element.dataset.dropZone + '-zone' };
    return null;
  }

  R.planDrop = planDrop;
  R.installDragDrop = function (root, { getGame, enabled, execute }) {
    let held = null, suppressClick = false;

    function clear() {
      if (!held) return;
      held.element.classList.remove('drag-origin');
      held.ghost?.remove();
      held.ready?.forEach(element => element.classList.remove('drop-ready', 'drop-hover'));
      root.classList.remove('dragging-item');
      if (root.hasPointerCapture?.(held.pointerId)) root.releasePointerCapture(held.pointerId);
      held = null;
    }

    function candidateAt(x, y) {
      return document.elementFromPoint(x, y)?.closest(targets) ?? null;
    }

    function selection(x, y) {
      const element = candidateAt(x, y);
      const action = element && planDrop(getGame(), held.source, describe(element));
      return { element: action ? element : null, action };
    }

    function begin(event) {
      held.active = true;
      held.element.classList.add('drag-origin');
      root.classList.add('dragging-item');
      const rect = held.element.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.style.font = getComputedStyle(held.element).font;
      ghost.style.setProperty('--folio-base', getComputedStyle(held.element).getPropertyValue('--folio-base') || '16px');
      const face = held.element.cloneNode(true);
      face.removeAttribute('data-act');
      face.removeAttribute('data-drag');
      face.removeAttribute('id');
      face.removeAttribute('disabled');
      face.removeAttribute('title');
      face.style.transform = 'none';
      face.tabIndex = -1;
      ghost.append(face);
      document.body.append(ghost);
      held.ghost = ghost;
      held.ready = [...root.querySelectorAll(targets)].filter(element =>
        planDrop(getGame(), held.source, describe(element)));
      held.ready.forEach(element => element.classList.add('drop-ready'));
      try { root.setPointerCapture(event.pointerId); } catch {}
    }

    function move(event) {
      if (!held || event.pointerId !== held.pointerId) return;
      if (held.scrolling) {
        event.preventDefault();
        held.scrolling.scrollLeft = held.scrollStart - (event.clientX - held.x);
        return;
      }
      if (!held.active) {
        const dx = event.clientX - held.x, dy = event.clientY - held.y;
        if (Math.hypot(dx, dy) < (held.touch ? 11 : 7)) return;
        const fan = held.source.kind === 'hand' && !held.touch && held.element.closest('.hand-fan');
        if (fan && fan.scrollWidth > fan.clientWidth && Math.abs(dx) > Math.abs(dy) * 1.3) {
          held.scrolling = fan;
          held.scrollStart = fan.scrollLeft;
          try { root.setPointerCapture(event.pointerId); } catch {}
          return;
        }
        begin(event);
      }
      event.preventDefault();
      held.ghost.style.left = event.clientX + 'px';
      held.ghost.style.top = (event.clientY - (held.touch ? 40 : 22)) + 'px';
      held.hover?.classList.remove('drop-hover');
      held.hover = selection(event.clientX, event.clientY).element;
      held.hover?.classList.add('drop-hover');
    }

    function end(event) {
      if (!held || event.pointerId !== held.pointerId) return;
      const active = Boolean(held.active || held.scrolling);
      const planned = held.active ? selection(event.clientX, event.clientY).action : null;
      clear();
      if (!active) return; // A tap remains the original button click.
      event.preventDefault();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (planned) execute(planned);
    }

    root.addEventListener('pointerdown', event => {
      if (!enabled() || event.button !== 0 || !event.isPrimary || held) return;
      const element = event.target.closest('[data-drag]');
      if (!element || element.disabled || !root.contains(element)) return;
      const source = { kind: element.dataset.drag, id: element.dataset.val, index: Number(element.dataset.val) };
      if (source.kind === 'slot-spell') source.id = element.dataset.skill;
      held = { pointerId: event.pointerId, element, source, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', active: false };
    });
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', event => {
      if (held?.pointerId === event.pointerId) clear();
    });
    window.addEventListener('blur', clear);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !held?.active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clear();
    }, true);
    root.addEventListener('click', event => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
    root.addEventListener('dragstart', event => {
      if (event.target.closest('[data-drag]')) event.preventDefault();
    });
    return clear;
  };
})();
