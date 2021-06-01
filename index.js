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
   startLine[1].split("?")[1].split("&").forEach(v => {
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
  
   if (/^\/$/.test(path)) {
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
         connection._username = query.username;
      CONNECTED_CLIENTS[connection._id] = connection;
  console.log("\x1b[33m%s\x1b[0m",`Client ${connection._id} has connected!`);

          let response = _PROTO_SWITCH_HEADER_.concat("Upgrade: websocket\r\n","Connection: Upgrade\r\n","Sec-WebSocket-Accept: " + crypto.createHash("sha1").update(headers["Sec-WebSocket-Key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64"),"\r\n");
/*
   if (headers["Sec-WebSocket-Extensions"]) {
      response = response.concat("Sec-WebSocket-Extensions: permessage-deflate\r\n").concat("Accept-Encoding: gzip\r\n");
   }
*/
    connection.write(response.concat("\r\n"));
 }
} else {
 // @TODO: Decipher and route message
parseMessage(data,connection._id);
}
 });

connection.on("close",() => {
if (connection._id) console.log("\x1b[33m%s\x1b[0m",`Client ${connection._id} has disconnected!`);
});

connection.on("error",(err) => {
 console.log("\x1b[31m%s\x1b","TRANSMISSION ERROR OCURRED! CLIENT_SOCKET: " + connection._id + " " + err); 
})
});


// Parse message...

function parseMessage(message,clientId) {
let data = new Uint8Array(message);
let _first_byte = data[0].toString(2);
let _second_byte = data[1].toString(2);
let code = parseInt(_first_byte.slice(4),2);

if (code == 0 || code == 2) {
let frame = {
_first_byte: _first_byte,
_second_byte: _second_byte,
FRAME: data,
FIN: Number(_first_byte[0]),
OPCODE: code,
COMPRESSED: Number(_first_byte[1]),
MASK: Number(_second_byte[0]),
RANGES: [data.slice(2,4),data.slice(2,10)]
};

let len = parseInt(frame._second_byte.slice(1),2);
frame.LENGTHS = [len,parseInt(data[2].toString(2) + data[3].toString(2),2),parseInt(data.slice(2,10).reduce((a,v) => { return a+v.toString(2) },""),2)];
if (len <= 125) {
frame.PAYLOAD_LENGTH = len;
frame.MASK_KEY = data.slice(2,6);
frame.PAYLOAD = data.slice(6,6+frame.PAYLOAD_LENGTH);
} else if (len < 127) {
frame.PAYLOAD_LENGTH = frame.LENGTHS[1];
frame.MASK_KEY = data.slice(4,8);
frame.PAYLOAD = data.slice(8,8+frame.PAYLOAD_LENGTH);
} else {
frame.PAYLOAD_LENGTH = frame.LENGTHS[2];
frame.MASK_KEY = data.slice(10,14);
frame.PAYLOAD = data.slice(14,14+frame.PAYLOAD_LENGTH-1);
}

if (frame.COMPRESSED) {
gunzip(frame.PAYLOAD,(err,buffer) => {
 if (!err) {
 frame.PAYLOAD = new Uint8Array(buffer);
} else {
console.log(err);
}
});
}

frame.UNMASKED_PAYLOAD = new Uint8Array(frame.PAYLOAD_LENGTH);
for (let i = 0; i < frame.PAYLOAD_LENGTH; i++) {
frame.UNMASKED_PAYLOAD[i] = frame.PAYLOAD[i] ^ frame.MASK_KEY[i % 4];
}
processMessage(frame,clientId);
} else {
console.log(`CONTROL FRAME FROM CLIENT ${clientId}: ${code}`);
}
}

// Process message...

function processMessage(frame,clientId) {
 let resFrame = {};
 resFrame._fin = frame.FIN;
 resFrame._exts = (frame.COMPRESSED) ? "100":"000";
 resFrame._opcode = bite(frame.OPCODE.toString(2),4);
 resFrame._payload_length = parseInt(bite(frame.FRAME[1].toString(2).slice(1)),2);
 resFrame._payload = frame.UNMASKED_PAYLOAD;
 
 if (resFrame._payload_length <= 125) {
resFrame._ext_length = [resFrame._payload_length];
} else if (resFrame._payload_length < 127) {
resFrame._ext_length = [resFrame._payload_length,...frame.FRAME.slice(2,4)];
} else {
resFrame._ext_length = [resFrame._payload_length,...frame.FRAME.slice(2,10)];
}

let response = new Uint8Array([parseInt(resFrame._fin+resFrame._exts+resFrame._opcode,2),...resFrame._ext_length,...resFrame._payload]);

// console.log(frame);
console.log(response,frame);

for (let i in CONNECTED_CLIENTS) {
if (i !== clientId) CONNECTED_CLIENTS[i].write(response);
}
}

server.listen(3000,() => {
 console.log("\x1b[32m%s\x1b[0m","Server is listening...");
});


