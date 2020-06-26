const express = require('express');
const app = express();
const { resolve } = require('path');
const bodyParser = require('body-parser');
require('dotenv').config({ path: './.env' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb+srv://***:***@cluster0-5tifl.mongodb.net/mydb?retryWrites=true&w=majority";


app.use(express.static(process.env.STATIC_DIR));
app.use((req, res, next) => {
  if (req.originalUrl === '/stripe-webhook') {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

app.get('/', (req, res) => {
  const path = resolve(process.env.STATIC_DIR + '/index.html');
  res.sendFile(path);
});

app.get('/config', async (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post('/create-customer', async (req, res) => {
  // Create a new customer object
  const customer = await stripe.customers.create({
    email: req.body.email,
  });
  res.send({ customer });
});

app.post('/create-subscription', async (req, res) => {
  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
  } catch (error) {
    return res.status('402').send({ error: { message: error.message } });
  }

  let updateCustomerDefaultPaymentMethod = await stripe.customers.update(
    req.body.customerId,
    {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    }
  );

  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [{ price: process.env[req.body.priceId] }],
    expand: ['latest_invoice.payment_intent'],
  });

  res.send(subscription);
});

app.post('/retry-invoice', async (req, res) => {
  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
    await stripe.customers.update(req.body.customerId, {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    });
  } catch (error) {
    // in case card_decline error
    return res
      .status('402')
      .send({ result: { error: { message: error.message } } });
  }

  const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
    expand: ['payment_intent'],
  });
  res.send(invoice);
});

app.post('/retrieve-upcoming-invoice', async (req, res) => {
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );

  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription_prorate: true,
    customer: req.body.customerId,
    subscription: req.body.subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        deleted: true,
      },
      {
        price: process.env[req.body.newPriceId],
        deleted: false,
      },
    ],
  });
  res.send(invoice);
});

app.post('/cancel-subscription', async (req, res) => {
  // Delete subscription
  const deletedSubscription = await stripe.subscriptions.del(
    req.body.subscriptionId
  );
  res.send(deletedSubscription);
});

app.post('/update-subscription', async (req, res) => {
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );
  const updatedSubscription = await stripe.subscriptions.update(
    req.body.subscriptionId,
    {
      cancel_at_period_end: false,
      items: [
        {
          id: subscription.items.data[0].id,
          price: process.env[req.body.newPriceId],
        },
      ],
    }
  );

  res.send(updatedSubscription);
});

app.post('/retrieve-customer-payment-method', async (req, res) => {
  const paymentMethod = await stripe.paymentMethods.retrieve(
    req.body.paymentMethodId
  );

  res.send(paymentMethod);
});
// Webhook
app.post(
  '/stripe-webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    // get event
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(err);
      console.log(`⚠️  Webhook signature verification failed.`);
      console.log(
        `⚠️  Check the env file and enter the correct webhook secret.`
      );
      return res.sendStatus(400);
    }
    // get obj from event
    const dataObject = event.data.object;

    switch (event.type) {
      case 'invoice.payment_succeeded':
        const custId = event['data']['object']['customer']
        const email = event['data']['object']['customer_email']
        console.log(`cust id: ${custId}`)
        console.log(`cust email: ${email}`)

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { CustomerId: custId , CustomerEmail : email , PaymentStatus : 'Success' };
          dbo.collection("payment").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 payment_success inserted");
            db.close();
          });
        });

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { Webhook: 'invoice.payment_succeeded' };
          dbo.collection("webhook").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 payment_success inserted(webhook)");
            db.close();
          });
        });
        
        break;
      case 'invoice.payment_failed':
        const custId2 = event['data']['object']['customer']
        const email2 = event['data']['object']['customer_email']
        console.log(`cust id: ${custId}`)
        console.log(`cust email: ${email}`)

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { CustomerId: custId2 , CustomerEmail : email2 , PaymentStatus : 'Failed' };
          dbo.collection("payment").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 payment_failed inserted");
            db.close();
          });
        });

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { Webhook: 'invoice.payment_failed' };
          dbo.collection("webhook").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 payment_failed inserted(webhook)");
            db.close();
          });
        });
        
        break;
      case 'customer.subscription.created':
        const subId = event['data']['object']['id']
        const custId3 = event['data']['object']['customer']
        const created = event['data']['object']['created']
        const periodStart = event['data']['object']['current_period_start']
        const periodEnd = event['data']['object']['current_period_end']
        const billingMethod = event['data']['object']['collection_method']
        const daysUntilDue = event['data']['object']['days_until_due']
        const status = event['data']['object']['status']
        
        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { subscriptionId: subId , CustomerId : custId3 , Created : created , StartPeriod : periodStart, EndPeriod : periodEnd,
             BillingMethod : billingMethod, DaysUntilDue: daysUntilDue, SubscriptionStatus : status , Status : "Created"};
          dbo.collection("subscription").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 subscription_created inserted");
            db.close();
          });
        });
        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { Webhook: 'customer.subscription.created' };
          dbo.collection("webhook").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 customer.subscription.created inserted(webhook)");
            db.close();
          });
        });
        
        break;  
      case 'customer.subscription.updated':

        const subId2 = event['data']['object']['id']
        const periodStart2 = event['data']['object']['current_period_start']
        const periodEnd2 = event['data']['object']['current_period_end']
        const billingMethod2 = event['data']['object']['collection_method']
        const status2 = event['data']['object']['status']

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myquery = { subscriptionId: subId2 };
          var newvalues = { $set: {StartPeriod: periodStart2, EndPeriod: periodEnd2,BillingMethod : billingMethod2,SubscriptionStatus : status2 , Status : "Updated" } };
          dbo.collection("subscription").updateOne(myquery, newvalues, function(err, res) {
            if (err) throw err;
            console.log("1 subscription_updated updated");
            db.close();
          });
        });

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { Webhook: 'customer.subscription.updated' };
          dbo.collection("webhook").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 customer.subscription.updated inserted(webhook)");
            db.close();
          });
        });
        break;  
      case 'customer.subscription.deleted':
        const subId3 = event['data']['object']['id']
        const status3 = event['data']['object']['status']

        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myquery = { subscriptionId: subId3 };
          var newvalues = { $set: {SubscriptionStatus : status3 , Status : "Canceled" } };
          dbo.collection("subscription").updateOne(myquery, newvalues, function(err, res) {
            if (err) throw err;
            console.log("1 subscription_deleted updated");
            db.close();
          });
        });
        MongoClient.connect(url, function(err, db) {
          if (err) throw err;
          var dbo = db.db("mydb");
          var myobj = { Webhook: 'customer.subscription.deleted' };
          dbo.collection("webhook").insertOne(myobj, function(err, res) {
            if (err) throw err;
            console.log("1 customer.subscription.deleted inserted(webhook)");
            db.close();
          });
        });
        break;
      default:
      
    }
    res.sendStatus(200);
  }
);

app.listen(4242, () => console.log(`Node server listening on port ${4242}!`));
