/**
 * Line-art illustrations of the kinds of business on SINT. All inline SVG so
 * they cost no requests, scale cleanly, and can be animated with CSS: steam
 * rising, water moving, scissors snipping, a gear turning.
 *
 * Each icon is 32x32 with a 1.6 stroke and inherits `currentColor`.
 */

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Frame({ children, ...rest }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export function StorefrontIcon(props) {
  return (
    <Frame {...props}>
      <path {...line} d="M6 13v13h20V13" />
      <g className="bi-awning">
        <path {...line} d="M4 13 6 7h20l2 6" />
        <path {...line} d="M8 13V8M13 13V8M18 13V8M23 13V8" />
      </g>
      <path {...line} d="M13 26v-6h6v6" />
      <path {...line} d="M8.5 17h2v2.5h-2z" />
    </Frame>
  );
}

export function CupIcon(props) {
  return (
    <Frame {...props}>
      <path {...line} d="M8 13h16l-1.6 11H9.6z" />
      <path {...line} d="M24 15h2.2a2.4 2.4 0 0 1 0 4.8h-1.4" />
      <path {...line} d="M6 26h20" />
      <g className="bi-steam">
        <path {...line} d="M13 10c1.4-1.5-1.4-2.4 0-4" />
        <path {...line} d="M18 10c1.4-1.5-1.4-2.4 0-4" />
      </g>
    </Frame>
  );
}

export function BedIcon(props) {
  return (
    <Frame {...props}>
      <path {...line} d="M6 20h21v5H6z" />
      <path {...line} d="M6 20v-6h3v6" />
      <path {...line} d="M9.5 20v-3h7v3" />
      <path {...line} d="M8 25v3M26 25v3" />
      <circle className="bi-glow" cx="25" cy="14" r="1.8" />
      <path {...line} d="M25 10v1.6" />
    </Frame>
  );
}

export function BoatIcon(props) {
  return (
    <Frame {...props}>
      <g className="bi-rock">
        <path {...line} d="M7 20h18l-3 5H10z" />
        <path {...line} d="M16 20V7" />
        <path {...line} d="M16 8.5 23 19h-7z" />
      </g>
      <g className="bi-water">
        <path {...line} d="M6 27h4M13 27h5M21 27h4" />
      </g>
    </Frame>
  );
}

export function ScissorsIcon(props) {
  return (
    <Frame {...props}>
      <g className="bi-blade-a">
        <path {...line} d="M12 5.5 20 19M20 19l-1.6 2.4" />
        <circle {...line} cx="10" cy="25" r="2.4" />
      </g>
      <g className="bi-blade-b">
        <path {...line} d="M20 5.5 12 19M12 19l1.6 2.4" />
        <circle {...line} cx="22" cy="25" r="2.4" />
      </g>
      <circle {...line} cx="16" cy="14" r="0.9" />
    </Frame>
  );
}

export function HealthIcon(props) {
  return (
    <Frame {...props}>
      <path
        {...line}
        d="M16 27s-9-5.4-9-11.2A5.3 5.3 0 0 1 16 11.4 5.3 5.3 0 0 1 25 15.8C25 21.6 16 27 16 27Z"
      />
      <path className="bi-pulse" {...line} d="M4 16.5h5l2-4 3 8 2-4h12" />
    </Frame>
  );
}

export function CocktailIcon(props) {
  return (
    <Frame {...props}>
      <path {...line} d="M9 8h14l-7 9z" />
      <path {...line} d="M16 17v7M12.5 25h7" />
      <circle className="bi-bubble" {...line} cx="16" cy="15" r="1.3" />
      <path {...line} d="M18.5 8 20 4" />
    </Frame>
  );
}

export function GearIcon(props) {
  return (
    <Frame {...props}>
      <g className="bi-gear">
        <circle {...line} cx="16" cy="16" r="5" />
        <path
          {...line}
          d="M16 6.5V9M16 23v2.5M6.5 16H9M23 16h2.5M9.2 9.2 11 11M21 21l1.8 1.8M22.8 9.2 21 11M11 21l-1.8 1.8"
        />
      </g>
    </Frame>
  );
}

export const BUSINESS_ICONS = {
  'Food & Drinks': CupIcon,
  'Retail Shops': StorefrontIcon,
  Accommodations: BedIcon,
  'Travel & Transportation': BoatIcon,
  'Beauty & Fashion': ScissorsIcon,
  'Health Care': HealthIcon,
  'Bars & Nightlife': CocktailIcon,
  Services: GearIcon,
};
