const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const net = require("net");

const server = net.createServer((connection) => {
 connection.on("data",(data) => {
  let request = data.toString();
  let lines = request.split("\r\n");
  let startLine = lines.shift().split(" ");
  let protocol = startLine[2].split("/")[0];
  let method = startLine[0];
  let path = startLine[1];
  let headers = {};

 const hdrs = lines.filter((h) => { return h.length > 1 });

  for (let i of hdrs) {
    let hdr = i.split(": ");
    headers[hdr[0]] = hdr[1];
  }

  console.log(request);

  let _OK_HEADER_ = "HTTP/1.1 200 OK\r\n";
  let _ISE_HEADER_ = "HTTP/1.1 500 Internal Server Error\r\n";
  let _PROTO_SWITCH_HEADER_ = "HTTP/1.1 101 Switching Protocols\r\n";
  
   if (path == "/") {
     fs.readFile("./index.html","ascii",(err,data) => {
       if (!err && data) {
          let page = _OK_HEADER_.concat("Content-Type: text/html; charset=utf-8","\r\n\r\n",data.replace("\n",""));
          connection.write(page);
          connection.end();
      } else {
        connection.write(_ISE_HEADER_);
        connection.end();
      }
     }); 
   } else if (path == "/chat") {
      let response = _PROTO_SWITCH_HEADER_.concat("Upgrade: websocket\r\n","Connection: Upgrade\r\n","Sec-WebSocket-Accept: " + crypto.createHash("sha1").update(headers["Sec-WebSocket-Key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64"),"\r\n");

    connection.end(response);
    console.log(response + "\r\n");
   }
 });
});

server.listen(3000,() => {
 console.log("\x1b[32m%s\x1b[0m","Server is listening...");
});


