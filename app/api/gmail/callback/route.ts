import {env} from "cloudflare:workers";
import {callback,sender,sendScope,cookieName,policy,saveGrant} from "../../../../lib/gmail-grant";
export const dynamic="force-dynamic";
const result=(msg:string,status:number)=>new Response(msg,{status,headers:{...policy,"Content-Type":"text/plain; charset=utf-8","Set-Cookie":cookieName+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}});
export async function GET(req:Request){
 if(!sender||!callback||!env.GMAIL_CLIENT_ID||!env.GMAIL_CLIENT_SECRET||!env.GMAIL_TOKEN_KEY)return result("发信配置尚未就绪。",503);
 const params=new URL(req.url).searchParams;
 const matches=(req.headers.get("Cookie")||"").match(/(?:^|;\s*)__Host-gmail-setup=([a-f0-9]{48})\.([a-f0-9]{64})(?:;|$)/);
 if(!matches||params.get("state")!==matches[1])return result("授权已过期，请重新打开网站的 Gmail 授权入口。",400);
 if(!params.get("code"))return result("未完成 Google 授权。",400);
 try{
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID!,client_secret:env.GMAIL_CLIENT_SECRET!,grant_type:"authorization_code",redirect_uri:callback,code:params.get("code")!,code_verifier:matches[2]}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)return result("Google 未接受这次授权，请重新开始。",400);
 const t=await r.json() as {access_token:string,refresh_token?:string,scope?:string};
 if(!t.refresh_token||!t.scope?.split(" ").includes(sendScope))return result("需要勾选 Gmail 发信权限并允许离线访问。",403);
 const user=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+t.access_token},signal:AbortSignal.timeout(12000)});
 if(!user.ok)return result("暂时无法确认发件邮箱。",403);
 const info=await user.json() as {email?:string,email_verified?:boolean};
 if(info.email_verified!==true||info.email?.toLowerCase()!==sender)return result("请选择配置的发件账号重新授权。",403);
 await saveGrant(t.refresh_token);
 return result("Gmail 发信授权已保存。可以回到结构化学注册页，向你的邮箱发送验证码。",200);
 }catch{return result("授权暂未保存，请重新授权。",503);}
}
