const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const net = require("net");
const { v4: uuid } = require("uuid");
const { bite } = require("./helpers.js");
const { gzip, gunzip } = require("zlib");

// Keep record of clients...

const CONNECTED_CLIENTS = {};

// Establish and manage websocket connection with clients...

const server = net.createServer((connection) => {

 connection.on("data",(data) => {
     if (!connection._id) {
  let request = data.toString();
  let lines = request.split("\r\n");
  let startLine = lines.shift().split(" ");
  let protocol = startLine[2].split("/")[0];
  let method = startLine[0];
  let path = startLine[1];
  let headers = {};
  let query = {};
  if (/\?/.test(path)) {
   startLine[1].split("?").split("&").forEach(v => {
     let params = v.split("=");
     query[params[0]] = params[1];
   });
}

 const hdrs = lines.filter((h) => { return h.length > 1 });
  for (let i of hdrs) {
    let hdr = i.split(": ");
    headers[hdr[0]] = hdr[1];
  }

  let _OK_HEADER_ = "HTTP/1.1 200 OK\r\n";
  let _ISE_HEADER_ = "HTTP/1.1 500 Internal Server Error\r\n";
  let _PROTO_SWITCH_HEADER_ = "HTTP/1.1 101 Switching Protocols\r\n";
  
   if (/^\//.test(path)) {
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
   } else if (/^\/chat/.test(path)) {
         connection._id = uuid();
      CONNECTED_CLIENTS[connection._id] = connection;
  console.log("\x1b[33m%s\x1b[0m",`A new client connected: ${connection._id}`);

          let response = _PROTO_SWITCH_HEADER_.concat("Upgrade: websocket\r\n","Connection: Upgrade\r\n","Sec-WebSocket-Accept: " + crypto.createHash("sha1").update(headers["Sec-WebSocket-Key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64"),"\r\n");

   if (headers["Sec-WebSocket-Extensions"]) {
      response = response.concat("Sec-WebSocket-Extensions: permessage-deflate\r\n").concat("Accept-Encoding: gzip\r\n");
   }

    connection.write(response.concat("\r\n\r\n"));
    console.log("\x1b[34m%s\x1b[0m","Handshake successful!"); 
   }
} else {
 // @TODO: Decipher and route message
parseMessage(data,connection._id);
}
 });

connection.on("error",(err) => {
 console.log("\x1b[31m%s\x1b","TRANSMISSION ERROR OCURRED! CLIENT_SOCKET: " + connection._id + " " + err); 
})

connection.on("close",() => {
console.log("\x1b[33m%s\x1b[0m","Client " + connection._id + "has disconnected!");
});

});


// Parse message...

function parseMessage(message,clientId) {
let data = new Uint8Array(message);

let frame = {
_first_bite: data[0].toString(2),
_second_bite: data[2].toString(2);
FRAME: data;
FIN: Number(this._first_bite[0]),
OPCODE: parseInt(this._first_bite.slice(4),2),
COMPRESSED: this._first_bite[1],
MASK: this._second_bite[0],
RANGES: [...data.slice(2,4),...data.slice(2,10)]
};

let len = parseInt(frame.second_bite.slice(1),2);
frame.LENGTHS = [len,parseInt(data[2].toString(2) + data[3].toString(2),2),parseInt(data.slice(2,10).reduce((a,v) => { return a+v.toString(2) },""))];
if (len <= 125) {
frame.PAYLOAD_LENGTH = len;
frame.MASK_KEY = data.slice(2,6);
frame.PAYLOAD = data.slice(6,frame.PAYLOAD_LENGTH-1);
} else if (len < 127) {
frame.PAYLOAD_LENGTH = frame.LENGTHS[1];
frame.MASK_KEY = data.slice(4,8);
frame.PAYLOAD = data.slice(8,frame.PAYLOAD_LENGTH-1);
} else {
frame.PAYLOAD_LENGTH = frame.LENGTHS[2];
frame.MASK_KEY = data.slice(10,14);
frame.PAYLOAD = data.slice(14,frame.PAYLOAD_LENGTH-1);
}

if (frame.COMPRESSED) {
gunzip(frame.PAYLOAD,(err,buffer) => {
 frame.PAYLOAD = new Uint8Array(buffer);
});
}

frame.UNMASKED_PAYLOAD = new Uint8Array(frame.PAYLOAD_LENGTH);
for (let i = 0; i < frame.PAYLOAD_LENGTH; i++) {
frame.UNMASKED_PAYLOAD[i] = frame.PAYLOAD[i] ^ frame.MASK_KEY[i % 4];
}
processMessage(frame,clientId);
}

// Process message...

function processMessage(frame,clientId) {
 let resFrame = {};
 resFrame._fin = frame.FIN;
 resFrame._exts = (frame.COMPRESSED) ? "100":"000";
 resFrame._opcode = bite(frame.OPCODE.toString(2),4);
 resFrame._payload_length = bite(frame.FRAME[1].toString(2).slice(1));
 resFrame._payload = frame.UNMASKED_PAYLOAD;
 
 if (resFrame._payload_length <= 125) {
resFrame._ext_length = [resFrame._payload_length];
} else if (resFrame._payload_length < 127) {
resFrame._ext_length = [resFrame._payload_length,...frame.FRAME.slice(2,4)];
} else {
resFrame._ext_length = [resFrame._payload_length,...frame.FRAME.slice(2,10)];
}

let response = new Uint8Array([parseInt(resFrame._fin+resFrame._exts+resFrame._opcode,2),...resFrame._ext_length,...resFrame._payload]);

console.log(frame);

for (let i in CONNECTED__CLIENTS) {
if (i !== clientId) CONNECTED_CLIENTS[i].write(response);
}
}

server.listen(3000,() => {
 console.log("\x1b[32m%s\x1b[0m","Server is listening...");
});


