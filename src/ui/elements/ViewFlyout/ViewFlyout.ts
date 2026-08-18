import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { show, snapGrid, grid, pin, graphNavigationReset } from '../../icons'

/**
 * The B3 View flyout: the grid and canvas-behaviour switches, opened by the mode
 * rail's View button (via {@link UIManager.modeStore}). Layout and physics used
 * to live here too — they now have their own rail mode, see
 * {@link PhysicsFlyout}.
 *
 * Every switch drives pre-existing {@link Simulation} / renderer state; the
 * {@link Flyout} base owns the panel chrome and the open/closed binding.
 */
export class ViewFlyout extends Flyout {
    protected readonly mode: FlyoutMode = 'view'

    protected template(): string {
        return this.headerRow(show, 'View')
            + this.sectionLabel('GRID &amp; CANVAS')
            + this.toggleRow('snap', snapGrid, 'Snap to grid', 'Align nodes to the grid while you drag them.')
            + this.toggleRow('highlight', grid, 'Highlight grid', 'Make the background grid lines more visible.')
            + this.toggleRow('freeze', pin, 'Freeze on drag', 'Keep nodes pinned where you drop them instead of letting physics move them again.')
            + this.toggleRow('fit', graphNavigationReset, 'Fit on expand/collapse', 'Zoom and re-center to fit the graph when clusters are expanded or collapsed.')
    }

    protected wire() {
        // Highlight the grid on the layout root so the canvas AND the transparent
        // top-bar strip (which continues the grid) brighten together.
        const root = this.uiManager.layout?.layout
        this.wireToggle('snap', () => this.sim.toggleGridSnapping(), () => this.sim.isGridSnappingEnabled())
        this.wireToggle('highlight',
            () => root?.classList.toggle('grid-highlighted'),
            () => root?.classList.contains('grid-highlighted') ?? false)
        this.wireToggle('freeze', () => this.sim.toggleFreezeNodesOnDrag(), () => this.sim.isFreezeNodesOnDrag())
        this.wireToggle('fit', () => this.sim.toggleFitViewOnExpandCollapse(), () => this.sim.isFitViewOnExpandCollapse())
    }
}
