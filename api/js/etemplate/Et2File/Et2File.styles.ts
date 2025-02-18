import {css} from 'lit';

export default css`
	:host {
	}

	.file--single > div {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
	}
	.file__file-list::part(popup) {
		min-width: 25em;
		background-color: var(--sl-panel-background-color);
		overflow-y: auto;
		z-index: var(--sl-z-index-toast);
	}
`;