import type { Point } from './drawing-geometry';

const CLICK_SLOP_PX = 4;

/** Press + release within a few pixels is a click; anything more is a drag (chart pan). */
export function isClick(down: Point, up: Point): boolean {
  return Math.abs(up.x - down.x) < CLICK_SLOP_PX && Math.abs(up.y - down.y) < CLICK_SLOP_PX;
}

/** True when the point lies in the main price pane (not the price scale, time axis or volume pane). */
export function isInPane(p: Point, pane: { width: number; height: number }): boolean {
  return p.x >= 0 && p.x < pane.width && p.y >= 0 && p.y < pane.height;
}
