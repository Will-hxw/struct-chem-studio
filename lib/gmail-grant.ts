import {env} from "cloudflare:workers";
export const sender=env.GMAIL_SENDER?.trim().toLowerCase() || "";
export const callback=env.GMAIL_REDIRECT_URI?.trim() || "";
export const sendScope="https://www.googleapis.com/auth/gmail.send";
export const cookieName="__Host-gmail-setup";
export const policy={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
const encode=(bytes:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer)));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(){
 const k=env.GMAIL_TOKEN_KEY;if(!k || !/^[a-f0-9]{64}$/.test(k))throw Error();
 return crypto.subtle.importKey("raw",Uint8Array.from(k.match(/../g)!,x=>parseInt(x,16)),"AES-GCM",false,["encrypt","decrypt"]);
}
export async function saveGrant(refresh:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(refresh));
 await env.DB!.prepare("INSERT INTO gmail_grant(sender,cipher,iv) VALUES(?,?,?) ON CONFLICT(sender) DO UPDATE SET cipher=excluded.cipher,iv=excluded.iv").bind(sender,encode(cipher),encode(iv)).run();
}
export async function readGrant(){
 if(env.GMAIL_REFRESH_TOKEN)return env.GMAIL_REFRESH_TOKEN;
 if(!env.DB||!env.GMAIL_TOKEN_KEY)return "";
 const row=await env.DB.prepare("SELECT cipher,iv FROM gmail_grant WHERE sender=?").bind(sender).first<{cipher:string;iv:string}>();
 if(!row)return "";
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(row.iv)},await key(),decode(row.cipher)));
}
