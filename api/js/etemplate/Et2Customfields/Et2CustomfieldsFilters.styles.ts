import {css} from "lit";

export default css`
	:host {
		display: block;
	}

	.customfields-filters {
		display: flex;
		flex-direction: column;
		gap: var(--sl-spacing-x-small, 0.5rem);
	}

	.customfields-filters__field {
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
	}

	.customfields-filters__label {
		line-height: 1.3;
	}

	.customfields-filters__field > *:not(label) {
		min-width: 0;
		width: 100%;
	}

	.customfields-filters__range {
		display: flex;
		gap: var(--sl-spacing-2x-small, 0.25rem);
	}

	.customfields-filters__range > * {
		flex: 1 1 50%;
		min-width: 0;
	}
`;
