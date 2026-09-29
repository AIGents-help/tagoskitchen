import {createClient} from "@supabase/supabase-js";

const url="https://aiiideoxiuzoizujkiui.supabase.co";

export function getSupabaseAdmin(){
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!key)throw new Error("Payments are not configured yet.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function requireSupabaseUser(request:Request){
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)throw new Error("Sign in before continuing.");
 const admin=getSupabaseAdmin();
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)throw new Error("Your session expired. Sign in again.");
 return {admin,user:data.user};
}
