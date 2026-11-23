import {env} from "cloudflare:workers";
import {random} from "../../../../lib/site-login";
import {callback,sender,sendScope,cookieName,policy} from "../../../../lib/gmail-grant";
export const dynamic="force-dynamic";
export async function GET(){
 if(!sender||!callback||!env.GMAIL_CLIENT_ID||!env.GMAIL_CLIENT_SECRET||!env.GMAIL_TOKEN_KEY)return new Response("发信配置尚未就绪。",{status:503,headers:policy});
 const state=random(24),verifier=random(32);
 const raw=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 u.search=new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,redirect_uri:callback,response_type:"code",scope:"openid email "+sendScope,state,code_challenge:challenge,code_challenge_method:"S256",access_type:"offline",prompt:"consent select_account",login_hint:sender}).toString();
 return new Response(null,{status:302,headers:{...policy,Location:u.href,"Set-Cookie":cookieName+"="+state+"."+verifier+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"}});
}
