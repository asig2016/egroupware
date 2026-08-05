import {css} from "lit";

/**
 * Selectors are written against the tag rather than :host because et2-customfields-filters
 * renders into its own light DOM - see lightDomStylesTemplate() in Et2CustomfieldsBase.
 */
export default css`
	et2-customfields-filters {
		display: block;
	}

	/*
	 * A filterbox sets --gap-width and spaces every filter it generates itself by it, so take that
	 * where there is one - otherwise the customfields sit visibly tighter than the filters above
	 * and below them.  Nothing else defines it, so anywhere else we keep our own close spacing.
	 */
	et2-customfields-filters .customfields-filters {
		display: flex;
		flex-direction: column;
		gap: var(--gap-width, var(--sl-spacing-2x-small, 0.25rem));
	}

	et2-customfields-filters .customfields-filters__field {
		min-width: 0;
	}

	et2-customfields-filters .customfields-filters__field > * {
		min-width: 0;
	}

	/*
	 * A from/to pair, eg. a float filter.  Only the from side carries the label (et2-label-fixed,
	 * so a --label-width column), so it gets that much more room and the two inputs come out equal.
	 */
	et2-customfields-filters .customfields-filters__range {
		display: flex;
		gap: var(--sl-spacing-2x-small, 0.25rem);
	}

	et2-customfields-filters .customfields-filters__range > * {
		flex: 1 1 calc(50% - var(--label-width, 8em) / 2);
		min-width: 0;
	}

	et2-customfields-filters .customfields-filters__range > [data-range="from"] {
		flex-basis: calc(50% + var(--label-width, 8em) / 2);
	}
`;
