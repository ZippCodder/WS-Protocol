const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const net = require("net");
const {v4: uuid} = require("uuid");
const { bite, split } = require("./helpers.js");

// Keep record of clients...

const CONNECTED_CLIENTS = {};

// Establish and manage websocket connection with clients...

const server = net.createServer((connection) => {
 connection.on("data",(data) => {
     if (connection._id == undefined && CONNECTED_CLIENTS[connection._id] == undefined) {
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
         connection._id = uuid();
       CONNECTED_CLIENTS[connection._id] = connection;
  console.log("\x1b[33m%s\x1b[0m",`Client ${connection._id} has connected!`);

          let response = _PROTO_SWITCH_HEADER_.concat("Upgrade: websocket\r\n","Connection: Upgrade\r\n","Sec-WebSocket-Accept: " + crypto.createHash("sha1").update(headers["Sec-WebSocket-Key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64"),"\r\n\r\n");
    connection.write(response);
   }
} else { 
  parseMessage(data,connection._id); 
}
 });

connection.on("error",(err) => {
 console.log("\x1b[31m%s\x1b","TRANSMISSION ERROR OCURRED! CLIENT_SOCKET: " + connection._id," ERROR: " + err); 
})

connection.on("close",() => {
if (connection._id !== undefined && CONNECTED_CLIENTS[connection._id] !== undefined) {
console.log("\x1b[33m%s\x1b[0m","Client " + connection._id + " has disconnected!");
delete CONNECTED_CLIENTS[connection._id];
}
});

});


// Parse message...

function parseMessage(msg,clientId) {
 // @TODO: Decipher and route frame

let binArrData = new Uint8Array(msg);

let frame = {
FIN: Number(bite(binArrData[0].toString(2))[0]),
OPCODE: Number(parseInt(bite(binArrData[0].toString(2)).slice(4,8),2)),
MASK: Boolean(bite(binArrData[1].toString(2))[0]),
FRAME: binArrData,
LRANGES: [[binArrData[2],binArrData[3]],binArrData.slice(2,10)]
}

let plLen = parseInt(bite(binArrData[1].toString(2)).slice(1),2);  
let plLenExt = parseInt(bite(binArrData[2].toString(2)) + bite(binArrData[3].toString(2)),2);
let plLenCont = parseInt(binArrData.slice(2,10).reduce((t,v) => { return t+bite(v.toString(2)) },""),2);

frame.LENGTHS = [plLen,plLenExt,plLenCont];
frame.PAYLOAD_LENGTH = (plLen <= 125) ? plLen: (plLen == 126) ? plLenExt:plLenCont;

if (plLen <= 125 ) {
frame.MASK_KEY = binArrData.slice(2,6);
frame.MASKED_PAYLOAD = binArrData.slice(6,6+frame.PAYLOAD_LENGTH);
} else if (plLen < 127) {
frame.MASK_KEY = binArrData.slice(4,8);
frame.MASKED_PAYLOAD = binArrData.slice(8,8+frame.PAYLOAD_LENGTH);
} else {
frame.MASK_KEY = binArrData.slice(10,14); 
frame.MASKED_PAYLOAD = binArrData.slice(14,14+frame.PAYLOAD_LENGTH);
}

frame.UNMASKED_PAYLOAD = new Uint8Array(frame.MASKED_PAYLOAD.length);

for (let i = 0; i < frame.PAYLOAD_LENGTH; i++) {
 frame.UNMASKED_PAYLOAD[i] = frame.MASKED_PAYLOAD[i] ^ frame.MASK_KEY[i % 4];
}
if (frame.OPCODE == 0 || frame.OPCODE == 2 || frame.OPCODE == 8) processMessage(frame,clientId);
if (frame.OPCODE == 1) processMessage(frame,clientId);
}

// Process message...

 function processMessage(frame,clientId) {
 let resFrame;
  if (frame.OPCODE == 0 || frame.OPCODE == 2) {
  let len;
if (frame.LENGTHS[0] <= 125 ) {
len = [frame.LENGTHS[0]];
} else if (frame.LENGTHS[0] < 127) {
len = [frame.LENGTHS[0], frame.LRANGES[0]];
} else {
len = [frame.LENGTHS[0], frame.LRANGES[1]];
}

  resFrame = new Uint8Array([parseInt(frame.FIN.toString(2) + "000" + bite(frame.OPCODE.toString(2),4),2),...len.flat(1),...frame.UNMASKED_PAYLOAD]);

for (let i in CONNECTED_CLIENTS) { 
if (CONNECTED_CLIENTS[i]._id !== clientId) CONNECTED_CLIENTS[i].write(resFrame);
} 
} else if (frame.OPCODE == 1) {
CONNECTED_CLIENTS[clientId].write(new Uint8Array([129,1,65]));
console.log((new TextDecoder()).decode(frame.UNMASKED_PAYLOAD));
}
console.log(frame,resFrame,"\n\n");
} 

server.listen(3000,() => {
console.log("\x1b[32m%s\x1b[0m","Server is listening...");
});

