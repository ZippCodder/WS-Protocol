let lib = {};

lib.bite = function (b,l=8) {
if (b.length >= 8) return b;
return "0".repeat(l-b.length) + b;
}

module.exports = lib;
