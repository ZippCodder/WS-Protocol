const lib = {};

lib.bite = (b,l=8) => {
if (b.length >= l) return b;
return "0".repeat(l - b.length).concat(b);
}

lib.split = (b,t=false) => {
 let bin = b.toString(2),i=bin.length-1;
 if (bin.length <= 8) return bin;
 let chuncks = [];
  while (bin.length > 8) {
   if (bin[i] == "1" && bin.slice(i).length == 8) {
  chuncks.unshift(bin.slice(i));
  bin = bin.slice(0,i);
} else if (bin[i] == "0" && bin.slice(i).length == 8) {
   let o = i+1,notfound = true;
   while (notfound) {
  if (bin[o] == "1") {
  chuncks.unshift(bin.slice(o));
  bin = bin.slice(0,o);
  notfound = false;
 } 
if (o == bin.length-1) {
 notfound = false;
 chuncks.unshift("00000000");
 bin = bin.slice(0,i);
}
  o++;
}
}
i--;
}
chuncks.unshift(bin);
if (t) { return chuncks.map(v => parseInt(v,2)) }
if (!t) { return chuncks }
}

module.exports = lib;
