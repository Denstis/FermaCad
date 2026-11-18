const http=require("http"),fs=require("fs"),path=require("path");
const root="E:/Hermes/GuiRoof";const MIME={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",png:"image/png",svg:"image/svg+xml"};
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p==="/")p="/index.html";
const f=path.join(root,p);if(!f.startsWith(root)){s.writeHead(403);return s.end()}
fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end("nf")}s.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cache-Control":"no-cache"});s.end(b)})}).listen(8150,"127.0.0.1",()=>console.log("up"));