import {NextResponse} from "next/server";
import {getStripe,siteOrigin} from "@/lib/stripe-server";
import {requireSupabaseUser} from "@/lib/supabase-server";

export async function GET(request:Request){
 try{
  const businessId=new URL(request.url).searchParams.get("businessId");if(!businessId)return NextResponse.json({error:"Business is required."},{status:400});
  const {admin,user}=await requireSupabaseUser(request);const {data:member}=await admin.from("business_members").select("business_id").eq("business_id",businessId).eq("user_id",user.id).maybeSingle();if(!member)return NextResponse.json({error:"This business does not belong to your account."},{status:403});
  const {data:business,error}=await admin.from("businesses").select("stripe_account_id,payouts_enabled").eq("id",businessId).single();if(error)throw error;if(!business.stripe_account_id)return NextResponse.json({connected:false,ready:false});
  const account=await getStripe().accounts.retrieve(business.stripe_account_id),ready=Boolean(account.payouts_enabled&&account.charges_enabled);await admin.from("businesses").update({payouts_enabled:ready}).eq("id",businessId);return NextResponse.json({connected:true,ready});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to check Stripe setup."},{status:400})}
}

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>({})) as {businessId?:string;returnTo?:string};
  const {admin,user}=await requireSupabaseUser(request);
  const {data:members,error:memberError}=await admin.from("business_members").select("business_id,role").eq("user_id",user.id).in("role",["owner","manager"]);
  if(memberError)throw memberError;
  const ids=(members||[]).map(m=>m.business_id);
  if(!ids.length)return NextResponse.json({error:"Business owner access required."},{status:403});
  let businessId=body.businessId;
  if(businessId&&!ids.includes(businessId))return NextResponse.json({error:"This business does not belong to your account."},{status:403});
  let kitchenId:string|undefined;
  if(!businessId){const {data:kitchen,error}=await admin.from("kitchens").select("id,owner_business_id").in("owner_business_id",ids).limit(1).maybeSingle();if(error)throw error;if(!kitchen)return NextResponse.json({error:"No kitchen is connected to this account."},{status:403});businessId=kitchen.owner_business_id;kitchenId=kitchen.id}
  const {data:business,error:businessError}=await admin.from("businesses").select("id,name,stripe_account_id").eq("id",businessId).single();
  if(businessError)throw businessError;
  const stripe=getStripe();let accountId=business.stripe_account_id as string|null;
  if(!accountId){const account=await stripe.accounts.create({type:"express",country:"US",capabilities:{card_payments:{requested:true},transfers:{requested:true}},business_profile:{product_description:`Payments through TaGo's — ${business.name}`},metadata:{tagos_business_id:business.id,...(kitchenId?{tagos_kitchen_id:kitchenId}:{})}});accountId=account.id;const {error}=await admin.from("businesses").update({stripe_account_id:accountId}).eq("id",business.id);if(error)throw error}
  else{const account=await stripe.accounts.retrieve(accountId);await admin.from("businesses").update({payouts_enabled:Boolean(account.payouts_enabled&&account.charges_enabled)}).eq("id",business.id)}
  const origin=siteOrigin(request),returnTo=body.returnTo==="/chef"?"/chef":"/host/dashboard";
  const link=await stripe.accountLinks.create({account:accountId,refresh_url:`${origin}${returnTo}?stripe=refresh`,return_url:`${origin}${returnTo}?stripe=return`,type:"account_onboarding"});
  return NextResponse.json({url:link.url});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to start Stripe setup."},{status:400})}
}
