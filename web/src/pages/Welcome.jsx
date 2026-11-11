import { Link } from 'react-router-dom';
import { CheckIcon } from '../components/icons.jsx';
import {
  BedIcon,
  BoatIcon,
  CocktailIcon,
  CupIcon,
  GearIcon,
  HealthIcon,
  ScissorsIcon,
  StorefrontIcon,
} from '../components/businessIcons.jsx';
import { DevLogin } from '../components/DevLogin.jsx';

const POINTS = [
  'Every business, shop, restaurant and freelancer in one directory',
  'A feed of what they post — follow the ones you care about',
  'Message a business directly, no phone tag',
];

const CATEGORIES = [
  'Food & Drinks',
  'Retail Shops',
  'Accommodations',
  'Travel & Transportation',
  'Beauty & Fashion',
  'Health Care',
  'Bars & Nightlife',
  'Services',
];

/** The kinds of business shown in the showcase row. */
const SHOWCASE = [
  { label: 'Shops', Icon: StorefrontIcon },
  { label: 'Food & drink', Icon: CupIcon },
  { label: 'Stays', Icon: BedIcon },
  { label: 'Tours', Icon: BoatIcon },
  { label: 'Beauty', Icon: ScissorsIcon },
  { label: 'Health', Icon: HealthIcon },
  { label: 'Nightlife', Icon: CocktailIcon },
  { label: 'Services', Icon: GearIcon },
];

/**
 * Landing screen.
 *
 * Motion is CSS only: staggered entrances, drifting grey light, a category
 * ticker, and line-art business illustrations that animate on their own
 * (awning sways, steam rises, water moves, scissors snip, gear turns). Nothing
 * is fetched, no animation library ships, and `prefers-reduced-motion`
 * stops all of it.
 */
export default function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-glow" aria-hidden="true">
        <span className="glow glow-a" />
        <span className="glow glow-b" />
      </div>

      {/* Faint line-art in the empty margins, so the page is not just white. */}
      <div className="welcome-art" aria-hidden="true">
        <StorefrontIcon className="art art-storefront" />
        <BoatIcon className="art art-boat" />
        <CupIcon className="art art-cup" />
      </div>

      <div className="welcome-inner">
        <div className="welcome-brand welcome-reveal" style={{ '--i': 0 }}>
          <span className="brand-mark">S</span>
          <span>SINT</span>
        </div>

        <h1 className="welcome-title welcome-reveal" style={{ '--i': 1 }}>
          Every business in Solomon Islands, one place.
        </h1>

        <p className="welcome-lede welcome-reveal" style={{ '--i': 2 }}>
          Solomon Islands Net Trade is a directory with a social feed. Find who sells what, follow
          them, and talk to them directly.
        </p>

        <div className="welcome-ticker welcome-reveal" style={{ '--i': 3 }} aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div className="ticker-group" key={copy}>
                {CATEGORIES.map((category) => (
                  <span className="ticker-item" key={`${copy}-${category}`}>
                    {category}
                    <span className="ticker-dot">·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <ul className="welcome-points">
          {POINTS.map((point, index) => (
            <li key={point} className="welcome-reveal" style={{ '--i': 4 + index }}>
              <CheckIcon />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="welcome-actions welcome-reveal" style={{ '--i': 7 }}>
          <Link to="/signup" className="btn btn-lg btn-block">
            Create an account
            <span className="btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/signin" className="btn btn-outline btn-lg btn-block">
            Sign in
          </Link>
        </div>

        <p className="welcome-foot welcome-reveal" style={{ '--i': 8 }}>
          Free for personal accounts. Businesses start with a 14 day free trial.
        </p>

        <div className="welcome-showcase welcome-reveal" style={{ '--i': 9 }} aria-hidden="true">
          {SHOWCASE.map(({ label, Icon }, index) => (
            <div className="showcase-tile" key={label} style={{ '--d': `${index * 0.4}s` }}>
              <Icon className="showcase-icon" />
              <span className="showcase-label">{label}</span>
            </div>
          ))}
        </div>

        <DevLogin />
      </div>
    </div>
  );
}
