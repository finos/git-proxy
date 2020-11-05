const toClass = function(obj, proto) {
  obj.__proto__ = proto;
  return obj;
};

module.exports.toClass = toClass;
