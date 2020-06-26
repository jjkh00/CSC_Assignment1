require 'stripe'
require 'sinatra'
require 'dotenv'
require 'sinatra/reloader' if development?

# Replace if using a different env file or config
Dotenv.load
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

set :static, true
set :public_folder, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :views, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :port, 5252

get '/' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'index.html')
  
end

get '/subs' do
  subscriptions = Stripe::Subscription.list(limit:20)
  subscriptions = subscriptions.select do | p |
    p.status == 'active'
  end
  content_type 'application/json'
  response = 
  {
    subscriptions: subscriptions
  }.to_json
end


get '/customer/:customer_id' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'customer.html')
end

get '/customer/:customer_id/payments' do
  customer_id = params['customer_id']
  puts "customer_id is #{customer_id}"
  
  payments = Stripe::PaymentIntent.list({customer:customer_id, limit:20})
  payments = payments.select do | p |
    p.status == 'succeeded'
  end
 
  content_type 'application/json'
  response = 
  {
    payments: payments
  }.to_json
end

post '/refund-payment' do
  params = JSON.parse(request.body.read)
  response = {}

  begin 
    request_params = {}
    payment_int = params['payment_id']
    #request_params['payment_intent'] = params['payment_id']
    #request_params['reason'] = 'requested_by_customer'
    #request_params['expand'] = ['payment_intent']
    

    refund = Stripe::Refund.create({
      payment_intent: payment_int,
    })

    response = {
      refund: refund
    }
    rescue Stripe::InvalidRequestError => e
      puts "Error is: #{e}"
      response = {
        error:{
          code: e.error.code,
          message: e.error.message
        }
      }
    end
      content_type 'application/json'
      response.to_json
  end

  post '/pause-subscription' do
    params = JSON.parse(request.body.read)
    response = {}
  
    begin 
      request_params = {}
      sub_id = params['subscription_id']
      
      pause_sub = Stripe::Subscription.update(
        sub_id,
        {
        pause_collection:{
          behavior: 'void',
        },
      }
      )
  
      response = {
        pause_sub: pause_sub
      }
      rescue Stripe::InvalidRequestError => e
        puts "Error is: #{e}"
        response = {
          error:{
            code: e.error.code,
            message: e.error.message
          }
        }
      end
        content_type 'application/json'
        response.to_json
    end

    post '/resume-subscription' do
      params = JSON.parse(request.body.read)
      response = {}
    
      begin 
        request_params = {}
        sub_id = params['subscription_id']
        
        resume_sub = Stripe::Subscription.update(
          sub_id,
          {
          pause_collection: '',
        }
        )
    
        response = {
          resume_sub: resume_sub
        }
        rescue Stripe::InvalidRequestError => e
          puts "Error is: #{e}"
          response = {
            error:{
              code: e.error.code,
              message: e.error.message
            }
          }
        end
          content_type 'application/json'
          response.to_json
      end

post '/webhook' do
  # You can use webhooks to receive information about asynchronous payment events.
  # For more about our webhook events check out https://stripe.com/docs/webhooks.
  webhook_secret = ENV['STRIPE_WEBHOOK_SECRET']
  payload = request.body.read
  if !webhook_secret.empty?
    # Retrieve the event by verifying the signature using the raw body and secret if webhook signing is configured.
    sig_header = request.env['HTTP_STRIPE_SIGNATURE']
    event = nil

    begin
      event = Stripe::Webhook.construct_event(
        payload, sig_header, webhook_secret
      )
    rescue JSON::ParserError => e
      # Invalid payload
      status 400
      return
    rescue Stripe::SignatureVerificationError => e
      # Invalid signature
      puts "⚠️  Webhook signature verification failed."
      status 400
      return
    end
  else
    data = JSON.parse(payload, symbolize_names: true)
    event = Stripe::Event.construct_from(data)
  end
  # Get the type of webhook event sent - used to check the status of PaymentIntents.
  event_type = event['type']
  data = event['data']
  data_object = data['object']

  if event_type == 'some.event'
    puts "🔔  Webhook received!"
  end

  content_type 'application/json'
  {
    status: 'success'
  }.to_json
end
