import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
// TODO: Import billing handlers
// import { handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted } from '@/lib/billing';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-03-31.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export async function POST(request: NextRequest) {
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 },
      );
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // TODO: Provision workspace or activate subscription
        // await handleCheckoutCompleted(session);
        console.log(`Checkout completed: ${session.id}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        // TODO: Update workspace tier / limits
        // await handleSubscriptionUpdated(subscription);
        console.log(`Subscription updated: ${subscription.id}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // TODO: Suspend or teardown workspace
        // await handleSubscriptionDeleted(subscription);
        console.log(`Subscription deleted: ${subscription.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}
