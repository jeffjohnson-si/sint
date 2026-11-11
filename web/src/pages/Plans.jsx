import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { PlansSkeleton } from '../components/Skeletons.jsx';
import { CheckIcon } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { longDate } from '../lib/format.js';

function stateCopy(subscription, enforced = true) {
  if (!subscription) return { label: 'No plan', detail: '' };

  switch (subscription.status) {
    case 'trialing':
      return {
        label: 'Free trial',
        detail: subscription.trialEndsAt
          ? `Your trial runs until ${longDate(subscription.trialEndsAt)}. Publish as much as you like until then.`
          : 'Your free trial is running.',
      };
    case 'active':
      return {
        label: 'Active',
        detail: [
          subscription.plan ? `${subscription.plan} plan` : '',
          subscription.currentPeriodEnd
            ? `renews ${longDate(subscription.currentPeriodEnd)}`
            : '',
          subscription.cancelAtPeriodEnd ? 'cancels at period end' : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'past_due':
      return { label: 'Payment due', detail: 'The last payment did not go through.' };
    case 'canceled':
      return {
        label: 'Ended',
        detail: enforced
          ? 'Your plan has ended. Your profile and posts stay visible, but you cannot publish.'
          : 'Your plan has ended, but publishing stays open while payments are not available.',
      };
    default:
      return { label: 'No plan', detail: '' };
  }
}

export default function Plans() {
  const { user, reloadUser } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await sint.subscription();
      setData(result);
      setError('');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCheckout = async (planId) => {
    setBusyPlan(planId);
    try {
      const result = await sint.checkout(planId);
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      toast.error('Dodo did not return a checkout link');
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setBusyPlan('');
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await sint.refreshSubscription();
      await Promise.all([load(), reloadUser().catch(() => {})]);
      toast.success('Billing state updated');
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (!user?.isPublisher) {
    return (
      <div className="page page-list">
        <h1 style={{ marginBottom: 12 }}>Plans</h1>
        <div className="card card-pad">
          <div className="empty-title">Plans are for businesses</div>
          <p className="small muted">
            Personal accounts are free forever — browse, follow, like, comment and message as much
            as you want.
          </p>
          <Link to="/" className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>
            Back to the feed
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-list">
        <PlansSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-list">
        <h1 style={{ marginBottom: 12 }}>Plans</h1>
        <div className="notice">
          {error}
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 8 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const subscription = data?.subscription ?? null;
  // While payments are not on sale, the server can tell us not to enforce the
  // paywall: publishing stays open even without an active plan.
  const enforced = data?.billingEnforced !== false;
  const state = stateCopy(subscription, enforced);
  const billingEnabled = data?.billingEnabled;
  const needsPlan = enforced && (!subscription || !['trialing', 'active'].includes(subscription.status));

  return (
    <div className="page page-list">
      <div className="page-head">
        <h1>Plans</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Checking…' : 'Refresh status'}
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row between">
          <span className="panel-title" style={{ margin: 0 }}>
            Current plan
          </span>
          <span className={needsPlan ? 'pill' : 'pill pill-dark'}>{state.label}</span>
        </div>
        {state.detail ? (
          <p className="small muted" style={{ marginTop: 8 }}>
            {state.detail}
          </p>
        ) : null}
        {subscription?.isBoosted ? (
          <p className="small" style={{ marginTop: 8 }}>
            Your posts are being pushed higher in the For You feed.
          </p>
        ) : null}
      </div>

      {needsPlan ? (
        <div className="notice notice-strong" style={{ marginBottom: 16 }}>
          Publishing is paused until you choose a plan. Everything already posted stays online.
        </div>
      ) : null}

      {!enforced ? (
        <div className="notice" style={{ marginBottom: 16 }}>
          Payments are not available yet, so every business can publish for free during the beta.
          Nothing to buy, nothing to renew.
        </div>
      ) : null}

      {!billingEnabled ? (
        <div className="notice" style={{ marginBottom: 16 }}>
          Card payments are not switched on for this server yet. Ask an administrator to add Dodo
          Payments credentials — plans and the free trial still work.
        </div>
      ) : null}

      <div className="plan-grid">
        {(data?.plans ?? []).map((plan) => {
          const featured = plan.id === 'yearly';
          const current = subscription?.plan === plan.id && subscription?.status === 'active';

          return (
            <div key={plan.id} className={featured ? 'plan featured' : 'plan'}>
              <div className="row between">
                <h3>{plan.label}</h3>
                {featured ? <span className="pill pill-dark">Best value</span> : null}
              </div>

              <div className="plan-price">{plan.priceText}</div>
              <div className="tiny muted">{plan.note}</div>

              <ul className="plan-benefits">
                {(plan.benefits ?? []).map((benefit) => (
                  <li key={benefit}>
                    <CheckIcon />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={featured ? 'btn btn-block' : 'btn btn-outline btn-block'}
                onClick={() => startCheckout(plan.id)}
                disabled={!billingEnabled || Boolean(busyPlan) || current}
                style={{ marginTop: 'auto' }}
              >
                {current
                  ? 'Current plan'
                  : busyPlan === plan.id
                    ? 'Opening checkout…'
                    : `Choose ${plan.label.toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="hint" style={{ marginTop: 16 }}>
        {data?.trialDays ? `Every new business starts with a ${data.trialDays} day free trial. ` : ''}
        Only business, company and freelancer accounts subscribe. Personal accounts are free.
      </p>
    </div>
  );
}
