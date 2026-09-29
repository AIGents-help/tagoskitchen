import Stripe from "stripe";

export function getStripe(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key)throw new Error("Stripe payments are not configured yet.");
 return new Stripe(key,{typescript:true});
}

export function paymentProcessingReady(){
 return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SECRET_KEY);
}

export function siteOrigin(request:Request){
 const configured=process.env.NEXT_PUBLIC_APP_URL;
 if(configured)return configured.replace(/\/$/,"");
 return new URL(request.url).origin;
}
