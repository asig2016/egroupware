import {css} from 'lit';

export default css`
	:host {
		display: block;
		position: relative;
		min-width: var(--sl-input-height-medium);
	}

	:host .toolbar {
		width: 100%;
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		overflow: hidden;
		align-items: center;

		.toolbar-buttons {
			display: flex;
			flex-direction: row;
			flex-wrap: nowrap;
			align-items: center;
			overflow: hidden;
			position: relative;
			flex: 1 1 100%;
		}
		.toolbar-list-trigger {
			font-size: var(--sl-font-size-large);
			&::part(base) {
				height: 100%;
			}
		}

		.toolbar-list {
			display: flex;
			flex-direction: column;

			/* Internal components in list */
			& > * {
				order: attr(data-order type(<number>), 99);
				max-width: 100%;
				&::part(base) {
					border-width: 0;
					padding: 0 var(--sl-spacing-large);
				}
			}
		}

		/* Anything put into the toolbar can flex */

		::slotted(*) {
			flex: 1 1 auto;
			order: attr(data-order type(<number>), 99);
			min-width: fit-content;
		}

		::slotted([slot='list']) {
			max-width: 100%;
		}

		/* We don't want these to expand */

		::slotted(sl-button-group), ::slotted(et2-button), ::slotted(et2-button-icon), ::slotted(et2-button-toggle), ::slotted(et2-switch), ::slotted(et2-checkbox) {
			flex: 0 0 fit-content;
			min-width: var(--sl-input-height-medium);
		}
		::slotted(sl-button-group)::part(base) {
			height: 100%;
		}
		::slotted(sl-button-group) {
			padding-left: var(--sl-spacing-3x-small);
			padding-right: var(--sl-spacing-3x-small);
			background: linear-gradient(var(--sl-panel-border-color) 0 0) left / var(--sl-panel-border-width, 2px) 50%;
			background-repeat: no-repeat;
		}
		::slotted(sl-button-group:first-child) {
			background: none;
		}
		/* Hide empty button groups (the buttons are in the list) */

		::slotted(sl-button-group:empty) {
			display: none;
		}
	}
`;
