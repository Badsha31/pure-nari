const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const ROOT=__dirname, DATA=path.join(ROOT,"data","site.json"), PORT=Number(process.env.PORT)||10000;
const sessions=new Map();
function load(){try{return JSON.parse(fs.readFileSync(DATA,"utf8"))}catch{return {}}}
function save(d){fs.mkdirSync(path.dirname(DATA),{recursive:true});fs.writeFileSync(DATA,JSON.stringify(d,null,2))}
function send(res,status,data,type="application/json"){res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(type.includes("json")?JSON.stringify(data):data)}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>2e6)req.destroy()});req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on("error",reject)})}
function auth(req){const t=(req.headers.authorization||"").replace(/^Bearer\s+/,"");return t&&sessions.has(t)}
function id(p="FWS"){return p+"-"+Date.now().toString(36)+"-"+crypto.randomBytes(3).toString("hex")}
function serve(req,res){let u=new URL(req.url,"http://x"),file=u.pathname==="/" ? "/index.html" : u.pathname==="/admin"||u.pathname==="/admin/" ? "/admin.html" : u.pathname;if(file.includes(".."))return send(res,403,{error:"Forbidden"});let f=path.join(ROOT,file);fs.readFile(f,(e,b)=>{if(e)return send(res,404,{error:"Not found"});let ext=path.extname(f),types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".json":"application/json"};send(res,200,b,types[ext]||"application/octet-stream")})}
const server=http.createServer(async(req,res)=>{try{let u=new URL(req.url,"http://x"),d=load();
if(u.pathname==="/api/login"&&req.method==="POST"){let b=await body(req);if(b.email===(process.env.ADMIN_EMAIL||"admin@purenari.com")&&b.password===(process.env.ADMIN_PASSWORD||"change-me")){let t=crypto.randomBytes(24).toString("hex");sessions.set(t,Date.now());return send(res,200,{token:t})}return send(res,401,{error:"Invalid credentials"})}
if(u.pathname==="/api/logout"&&req.method==="POST"){let t=(req.headers.authorization||"").replace(/^Bearer\s+/,"");sessions.delete(t);return send(res,200,{ok:true})}
if(u.pathname==="/api/site"&&req.method==="GET")return send(res,200,{...d,orders:undefined,leads:undefined});
if(u.pathname==="/api/reviews"&&req.method==="GET")return send(res,200,(d.reviews||[]).filter(x=>x.approved));
if(u.pathname==="/api/reviews"&&req.method==="POST"){let b=await body(req);if(!b.name||!b.text)return send(res,400,{error:"Name and review are required"});let r={id:id("REV"),name:String(b.name).slice(0,80),rating:Math.min(5,Math.max(1,Number(b.rating)||5)),text:String(b.text).slice(0,1000),image:b.image||"",date:new Date().toISOString().slice(0,10),approved:false};d.reviews=[r,...(d.reviews||[])];save(d);return send(res,201,{ok:true,message:"Review submitted for approval"})}
if(u.pathname==="/api/orders"&&req.method==="POST"){let b=await body(req);if(!b.name||!b.phone||!b.address||!Array.isArray(b.items)||!b.items.length)return send(res,400,{error:"Complete order details are required"});let o={id:id("FWS"),name:b.name,phone:b.phone,address:b.address,items:b.items,payment:b.payment||"COD",transactionId:b.transactionId||"",total:Number(b.total)||0,status:"Pending",createdAt:new Date().toISOString()};d.orders=[o,...(d.orders||[])];save(d);return send(res,201,{ok:true,orderId:o.id})}
if(u.pathname==="/api/leads"&&req.method==="POST"){let b=await body(req);d.leads=[{id:id("LEAD"),...b,createdAt:new Date().toISOString()},...(d.leads||[])];save(d);return send(res,201,{ok:true})}
if(u.pathname==="/api/chat"&&req.method==="POST"){let b=await body(req),q=String(b.message||"").toLowerCase(),reply="I can help with three-piece designs, fabric, sizing, price, delivery and orders. You can also contact our fashion agent.";
if(/agent|human|মানুষ|কথা/.test(q))reply="Sure — tap the Contact Agent button above me to reach our FashioN /w SoniA fashion agent.";
else if(/delivery|ডেলিভারি|কুরিয়ার/.test(q))reply="We can guide you about delivery and address details. For the latest delivery confirmation, please contact the fashion agent.";
else if(/size|সাইজ|measurement|মাপ/.test(q))reply="For the best fit, compare your measurements with the size information available for the selected design, or ask our fashion agent.";
else if(/fabric|কাপড়|cotton|embroidered|embroidery/.test(q))reply="Open a product's Details section to see its fabric/care description. If you need a specific fabric, ask the fashion agent.";
else if(/order|অর্ডার|buy|কিনবো/.test(q))reply="Open a product, tap Order now, then enter your name, phone, address and payment method.";
else if(/price|দাম|tk|৳/.test(q))reply="Product prices are shown directly on each product card and in the product details.";
else if(/three piece|threepiece|3 piece|থ্রি পিস/.test(q))reply="We have multiple three-piece collections including embroidered, cotton, printed, party and premium styles.";
return send(res,200,{reply})}
if(u.pathname==="/api/admin/stats"&&req.method==="GET"&&auth(req))return send(res,200,{orders:d.orders?.length||0,revenue:(d.orders||[]).reduce((s,o)=>s+(Number(o.total)||0),0),products:d.products?.length||0,reviews:d.reviews?.length||0,leads:d.leads?.length||0});
if(u.pathname==="/api/admin/orders"&&req.method==="GET"&&auth(req))return send(res,200,d.orders||[]);
if(u.pathname==="/api/admin/reviews"&&req.method==="GET"&&auth(req))return send(res,200,d.reviews||[]);
if(u.pathname==="/api/admin/leads"&&req.method==="GET"&&auth(req))return send(res,200,d.leads||[]);
let m=u.pathname.match(/^\/api\/admin\/(orders|reviews|leads)\/([^/]+)$/);if(m&&req.method==="PATCH"&&auth(req)){let b=await body(req),arr=d[m[1]]||[],i=arr.findIndex(x=>x.id===m[2]);if(i<0)return send(res,404,{error:"Not found"});arr[i]={...arr[i],...b};d[m[1]]=arr;save(d);return send(res,200,{ok:true})}
if(u.pathname==="/api/site"&&req.method==="PUT"&&auth(req)){let b=await body(req);d={...d,...b};save(d);return send(res,200,{ok:true})}
serve(req,res)}catch(e){send(res,500,{error:"Server error"})}});
server.listen(PORT,"0.0.0.0",()=>console.log("FASHION WITH SONIA running on "+PORT));